/**
 * Living World Extension for SillyTavern
 * Creates a dynamic, living world by generating character states and actions
 * based on chat history and lorebook data.
 */

import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";
import { loadWorldInfo } from "../../../world-info.js";

// Extension configuration
const MODULE_NAME = "living-world";
// This will be "Alive-World-Extension" when installed from GitHub
const extensionFolderPath = `scripts/extensions/third-party/Alive-World-Extension`;

// Default settings
const defaultSettings = {
    enabled: false,
    
    // Lorebook Configuration
    selectedLorebook: '',
    selectedCharacterListEntry: '',
    
    // Generation Configuration
    connectionProfile: '',
    preset: 'current',
    characterQuantity: 20,
    
    // Injection Configuration
    injectionStrategy: {
        type: 'depth',
        depth: 1,
        role: 'system'
    },
    
    // Advanced
    autoTrigger: true,
    debugMode: false
};

/**
 * Get or initialize extension settings
 */
function getSettings() {
    if (!extension_settings[MODULE_NAME]) {
        extension_settings[MODULE_NAME] = structuredClone(defaultSettings);
    }
    
    // Ensure all default keys exist
    for (const key of Object.keys(defaultSettings)) {
        if (!Object.hasOwn(extension_settings[MODULE_NAME], key)) {
            extension_settings[MODULE_NAME][key] = defaultSettings[key];
        }
    }
    
    return extension_settings[MODULE_NAME];
}

/**
 * Save settings with debounce
 */
function saveSettings() {
    saveSettingsDebounced();
}

/**
 * Log debug messages if debug mode is enabled
 */
function debugLog(...args) {
    const settings = getSettings();
    if (settings.debugMode) {
        console.log('[Living World]', ...args);
    }
}

/**
 * Load the settings UI
 */
async function loadSettingsUI() {
    try {
        const settingsHtml = await $.get(`${extensionFolderPath}/settings-panel.html`);
        $("#extensions_settings2").append(settingsHtml);
        console.log('[Living World] Settings UI loaded successfully');
    } catch (error) {
        console.error('[Living World] Failed to load settings UI:', error);
        toastr.error('Failed to load Living World settings UI');
    }
}

/**
 * Load available connection profiles into the dropdown
 */
function loadConnectionProfiles() {
    try {
        const profiles = extension_settings.connectionManager?.profiles || [];
        const profileSelect = $("#living-world-connection-profile");
        
        profileSelect.html('<option value="">Use Current API Settings</option>');
        
        profiles.forEach(profile => {
            const option = $('<option></option>')
                .val(profile.id)
                .text(profile.name || profile.id);
            profileSelect.append(option);
        });
        
        // Restore previous selection
        const settings = getSettings();
        if (settings.connectionProfile) {
            profileSelect.val(settings.connectionProfile);
        }
        
        debugLog(`Loaded ${profiles.length} connection profiles`);
        
    } catch (error) {
        console.error('[Living World] Error loading connection profiles:', error);
    }
}

/**
 * Update UI elements with current settings
 */
function updateUI() {
    const settings = getSettings();
    
    $("#living-world-enabled").prop("checked", settings.enabled);
    $("#living-world-lorebook").val(settings.selectedLorebook);
    $("#living-world-character-quantity").val(settings.characterQuantity);
    $("#living-world-character-quantity-value").text(settings.characterQuantity);
    $("#living-world-auto-trigger").prop("checked", settings.autoTrigger);
    $("#living-world-debug-mode").prop("checked", settings.debugMode);
    $("#living-world-injection-type").val(settings.injectionStrategy.type);
    $("#living-world-injection-depth").val(settings.injectionStrategy.depth);
    $("#living-world-injection-role").val(settings.injectionStrategy.role);
    $("#living-world-connection-profile").val(settings.connectionProfile);
    $("#living-world-preset").val(settings.preset);
    
    // Update UI visibility based on injection type
    updateInjectionUI();
}

/**
 * Update injection strategy UI visibility
 */
function updateInjectionUI() {
    const settings = getSettings();
    const isDepthType = settings.injectionStrategy.type === 'depth';
    
    $("#living-world-depth-options").toggle(isDepthType);
}

/**
 * Attach event handlers to UI elements
 */
function attachEventHandlers() {
    // Enable/disable toggle
    $("#living-world-enabled").on("change", function() {
        const settings = getSettings();
        settings.enabled = $(this).prop("checked");
        saveSettings();
        debugLog('Extension enabled:', settings.enabled);
    });
    
    // Character quantity
    $("#living-world-character-quantity").on("input", function() {
        const settings = getSettings();
        const value = parseInt($(this).val()) || 20;
        settings.characterQuantity = value;
        $("#living-world-character-quantity-value").text(value);
        saveSettings();
        debugLog('Character quantity:', settings.characterQuantity);
    });
    
    // Auto-trigger
    $("#living-world-auto-trigger").on("change", function() {
        const settings = getSettings();
        settings.autoTrigger = $(this).prop("checked");
        saveSettings();
    });
    
    // Debug mode
    $("#living-world-debug-mode").on("change", function() {
        const settings = getSettings();
        settings.debugMode = $(this).prop("checked");
        saveSettings();
    });
    
    // Injection strategy type
    $("#living-world-injection-type").on("change", function() {
        const settings = getSettings();
        settings.injectionStrategy.type = $(this).val();
        saveSettings();
        updateInjectionUI();
        debugLog('Injection type:', settings.injectionStrategy.type);
    });
    
    // Injection depth
    $("#living-world-injection-depth").on("input", function() {
        const settings = getSettings();
        settings.injectionStrategy.depth = parseInt($(this).val()) || 1;
        saveSettings();
        debugLog('Injection depth:', settings.injectionStrategy.depth);
    });
    
    // Injection role
    $("#living-world-injection-role").on("change", function() {
        const settings = getSettings();
        settings.injectionStrategy.role = $(this).val();
        saveSettings();
        debugLog('Injection role:', settings.injectionStrategy.role);
    });
    
    // Manual generation button
    $("#living-world-generate-manual").on("click", async function() {
        await generateLivingWorld(true);
    });
    
    // Lorebook selection
    $("#living-world-lorebook").on("change", async function() {
        const settings = getSettings();
        settings.selectedLorebook = $(this).val();
        saveSettings();
        await loadLorebookEntries();
        debugLog('Lorebook selected:', settings.selectedLorebook);
    });
    
    // Character list entry selection
    $("#living-world-character-list-entry").on("change", function() {
        const settings = getSettings();
        settings.selectedCharacterListEntry = $(this).val();
        saveSettings();
        debugLog('Character list entry:', settings.selectedCharacterListEntry);
    });
    
    // Connection profile selection
    $("#living-world-connection-profile").on("change", function() {
        const settings = getSettings();
        settings.connectionProfile = $(this).val();
        saveSettings();
        debugLog('Connection profile:', settings.connectionProfile);
    });
    
    // Preset selection
    $("#living-world-preset").on("change", function() {
        const settings = getSettings();
        settings.preset = $(this).val();
        saveSettings();
        debugLog('Preset:', settings.preset);
    });
}

/**
 * Load available lorebooks into the dropdown
 */
async function loadLorebooks() {
    try {
        const response = await fetch('/api/settings/get', {
            method: 'POST',
            headers: getContext().getRequestHeaders(),
            body: JSON.stringify({}),
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch world info list');
        }
        
        const data = await response.json();
        const worldNames = data.world_names || [];
        
        const lorebookSelect = $("#living-world-lorebook");
        lorebookSelect.html('<option value="">Select a lorebook...</option>');
        
        worldNames.forEach(name => {
            const option = $('<option></option>')
                .val(name)
                .text(name);
            lorebookSelect.append(option);
        });
        
        // Restore previous selection
        const settings = getSettings();
        if (settings.selectedLorebook) {
            lorebookSelect.val(settings.selectedLorebook);
            await loadLorebookEntries();
        }
        
        debugLog(`Loaded ${worldNames.length} lorebooks`);
        
    } catch (error) {
        console.error('[Living World] Error loading lorebooks:', error);
        toastr.error('Failed to load lorebooks');
    }
}

/**
 * Load entries from selected lorebook
 */
async function loadLorebookEntries() {
    const settings = getSettings();
    
    if (!settings.selectedLorebook) {
        $("#living-world-character-list-entry").html('<option value="">Select a lorebook first</option>');
        return;
    }
    
    try {
        const lorebookData = await loadWorldInfo(settings.selectedLorebook);
        
        if (!lorebookData || !lorebookData.entries) {
            debugLog('No entries found in lorebook');
            return;
        }
        
        // Populate dropdown with entries
        const entrySelect = $("#living-world-character-list-entry");
        entrySelect.html('<option value="">Select character list entry...</option>');
        
        Object.values(lorebookData.entries).forEach(entry => {
            const option = $('<option></option>')
                .val(entry.uid)
                .text(entry.comment || `Entry ${entry.uid}`);
            entrySelect.append(option);
        });
        
        // Restore previous selection if exists
        if (settings.selectedCharacterListEntry) {
            entrySelect.val(settings.selectedCharacterListEntry);
        }
        
        debugLog(`Loaded ${Object.keys(lorebookData.entries).length} entries`);
    } catch (error) {
        console.error('[Living World] Error loading lorebook entries:', error);
        toastr.error('Failed to load lorebook entries');
    }
}

/**
 * Generate living world state
 * @param {boolean} manual - Whether this is a manual generation
 */
async function generateLivingWorld(manual = false) {
    const settings = getSettings();
    
    if (!settings.enabled && !manual) {
        return;
    }
    
    debugLog('Generating living world state...');
    toastr.info('Generating living world state...');
    
    try {
        // TODO: Implement full generation logic
        // 1. Load character list from selected entry
        // 2. Analyze chat history
        // 3. Calculate character relevance
        // 4. Generate world state with AI
        // 5. Format and return
        
        debugLog('Generation complete (placeholder)');
        toastr.success('Living world generated!');
        
    } catch (error) {
        console.error('[Living World] Generation error:', error);
        toastr.error('Failed to generate living world');
    }
}

/**
 * Prompt interceptor - called before main generation
 * This is registered in manifest.json as "livingWorldInterceptor"
 * @param {Array} chat - The chat messages array (mutable)
 * @param {number} contextSize - Current context size in tokens
 * @param {Function} abort - Function to abort generation
 * @param {string} type - Generation type ('normal', 'swipe', 'quiet', etc.)
 */
globalThis.livingWorldInterceptor = async function(chat, contextSize, abort, type) {
    const settings = getSettings();
    
    // Skip if disabled
    if (!settings.enabled) {
        return;
    }
    
    // Skip if auto-trigger is off
    if (!settings.autoTrigger) {
        return;
    }
    
    // Skip for certain generation types
    if (type === 'quiet' || type === 'dry-run') {
        return;
    }
    
    debugLog('Interceptor triggered', { type, contextSize, chatLength: chat.length });
    
    try {
        // TODO: Implement full interception logic
        // For now, just log that we intercepted
        debugLog('Interception complete (placeholder)');
        
    } catch (error) {
        console.error('[Living World] Interceptor error:', error);
        // Don't abort main generation on error
    }
};

/**
 * Initialize extension
 */
jQuery(async () => {
    console.log('[Living World] Initializing extension...');
    
    try {
        // Load settings UI
        await loadSettingsUI();
        
        // Attach event handlers
        attachEventHandlers();
        
        // Update UI with current settings
        updateUI();
        
        // Load initial data
        await loadLorebooks();
        await loadConnectionProfiles();
        
        console.log('[Living World] Extension initialized successfully');
    } catch (error) {
        console.error('[Living World] Initialization error:', error);
        toastr.error('Living World extension failed to initialize');
    }
});
