const vscode = require('vscode');
const fs = require('fs').promises;
const path = require('path');

const OPACITY_PRESETS = {
    'Low': 0.3,
    'Medium': 0.6,
    'High': 0.9,
    'Custom': null
};

let originalThemes = new Map();

async function activate(context) {
    console.log('Glassmorphism Themes Manager is now active!');

    // Initialize originalThemes map
    const themesDir = path.join(__dirname, 'themes');
    try {
        const files = await fs.readdir(themesDir);
        for (const file of files) {
            if (file.endsWith('.json')) {
                const filePath = path.join(themesDir, file);
                const originalContent = await fs.readFile(filePath, 'utf8');
                originalThemes.set(file, originalContent);
            }
        }
    } catch (error) {
        console.error('Error initializing original themes:', error);
    }

    let adjustOpacityDisposable = vscode.commands.registerCommand('glassmorphismThemes.adjustOpacity', adjustOpacity);
    let toggleEffectDisposable = vscode.commands.registerCommand('glassmorphismThemes.toggleEffect', toggleEffect);

    context.subscriptions.push(adjustOpacityDisposable, toggleEffectDisposable);

    vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('glassmorphismThemes')) {
            updateThemes();
        }
    });

    await updateThemes();
}

async function adjustOpacity() {
    const config = vscode.workspace.getConfiguration('glassmorphismThemes');
    const currentPreset = config.get('opacityPreset');
    const currentOpacity = config.get('opacity');

    const options = Object.keys(OPACITY_PRESETS).map(preset => ({
        label: preset,
        description: preset === 'Custom' ? `Current: ${currentOpacity}` : `Opacity: ${OPACITY_PRESETS[preset]}`,
        picked: preset === currentPreset
    }));

    const selection = await vscode.window.showQuickPick(options, {
        placeHolder: 'Select opacity preset or choose Custom to enter a value'
    });

    if (selection) {
        if (selection.label === 'Custom') {
            const customOpacity = await vscode.window.showInputBox({
                prompt: "Enter custom opacity (0.1 to 1.0)",
                value: currentOpacity.toString(),
                validateInput: (value) => {
                    const num = parseFloat(value);
                    return (num >= 0.1 && num <= 1.0) ? null : "Please enter a number between 0.1 and 1.0";
                }
            });
            if (customOpacity) {
                await updateOpacity(parseFloat(customOpacity), 'Custom');
            }
        } else {
            await updateOpacity(OPACITY_PRESETS[selection.label], selection.label);
        }
    }
}

async function toggleEffect() {
    const config = vscode.workspace.getConfiguration('glassmorphismThemes');
    const currentState = config.get('enabled');
    await config.update('enabled', !currentState, true);
    vscode.window.showInformationMessage(`Glassmorphism effect ${!currentState ? 'enabled' : 'disabled'}`);
    await updateThemes();
}

async function updateOpacity(opacity, preset) {
    const config = vscode.workspace.getConfiguration('glassmorphismThemes');
    await config.update('opacity', opacity, true);
    await config.update('opacityPreset', preset, true);
    vscode.window.showInformationMessage(`Glassmorphism opacity set to ${opacity} (${preset})`);
    await updateThemes();
}

async function updateThemes() {
    const config = vscode.workspace.getConfiguration('glassmorphismThemes');
    const enabled = config.get('enabled');
    const preset = config.get('opacityPreset');
    let opacity = config.get('opacity');

    if (preset !== 'Custom' && OPACITY_PRESETS[preset] !== null) {
        opacity = OPACITY_PRESETS[preset];
    }

    if (enabled) {
        await applyOpacityToThemes(opacity);
    } else {
        await resetThemes();
    }
}

async function applyOpacityToThemes(opacity) {
    const themesDir = path.join(__dirname, 'themes');
    try {
        const files = await fs.readdir(themesDir);
        for (const file of files) {
            if (file.endsWith('.json')) {
                await updateThemeFile(path.join(themesDir, file), opacity);
            }
        }
        await promptReload();
    } catch (error) {
        vscode.window.showErrorMessage(`Error updating themes: ${error.message}`);
    }
}

async function resetThemes() {
    const themesDir = path.join(__dirname, 'themes');
    try {
        for (const [file, originalContent] of originalThemes) {
            const filePath = path.join(themesDir, file);
            await fs.writeFile(filePath, originalContent, 'utf8');
        }
        vscode.window.showInformationMessage('Themes reset to original state');
        await promptReload();
    } catch (error) {
        vscode.window.showErrorMessage(`Error resetting themes: ${error.message}`);
    }
}

async function updateThemeFile(filePath, opacity) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        let theme = JSON.parse(data);
        
        if (theme.colors) {
            Object.keys(theme.colors).forEach(key => {
                if (typeof theme.colors[key] === 'string' && theme.colors[key].startsWith('#')) {
                    theme.colors[key] = addOpacityToColor(theme.colors[key], opacity);
                }
            });
        }

        await fs.writeFile(filePath, JSON.stringify(theme, null, 2));
    } catch (error) {
        throw new Error(`Failed to update ${path.basename(filePath)}: ${error.message}`);
    }
}

function addOpacityToColor(color, opacity) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

async function promptReload() {
    const selection = await vscode.window.showInformationMessage(
        'Glassmorphism themes updated. Reload window to apply changes?', 
        'Reload'
    );
    if (selection === 'Reload') {
        vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
