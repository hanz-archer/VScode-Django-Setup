import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

// Function to set up static files configuration in settings.py
async function setupStaticConfiguration(workspaceFolder: string, projectName: string) {
    const projectDir = path.join(workspaceFolder, projectName);
    const settingsFilePath = path.join(projectDir, projectName, 'settings.py');

    try {
        if (!fs.existsSync(settingsFilePath)) {
            vscode.window.showErrorMessage(`settings.py not found in project ${projectName}.`);
            return;
        }

        let settingsContent = fs.readFileSync(settingsFilePath, 'utf8');

        // Add STATICFILES_DIRS and STATIC_ROOT configuration if not already present
        if (!settingsContent.includes('STATICFILES_DIRS')) {
            settingsContent += `

// Static files (CSS, JavaScript, Images)
import os
STATIC_URL = '/static/'
STATICFILES_DIRS = [os.path.join(BASE_DIR, 'static')]
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
            `;
            fs.writeFileSync(settingsFilePath, settingsContent, 'utf8');
            vscode.window.showInformationMessage('Static files configuration added to settings.py.');
        } else {
            vscode.window.showInformationMessage('Static files configuration already exists in settings.py.');
        }
    } catch (error) {
        vscode.window.showErrorMessage('Failed to add static files configuration to settings.py.');
    }
}

// Function to set up Django workspace
async function setupDjangoWorkspace(workspaceFolder: string, projectName: string, appName: string) {
    // Step 1: Check if Python is installed
    try {
        child_process.execSync('python --version', { stdio: 'ignore' });
    } catch (error) {
        vscode.window.showErrorMessage('Python is not installed or not added to PATH. Please fix this before proceeding.');
        return;
    }

    // Step 2: Create Django project
    const projectPath = path.join(workspaceFolder, projectName);
    if (fs.existsSync(projectPath)) {
        vscode.window.showErrorMessage(`The project folder ${projectName} already exists.`);
        return;
    }

    try {
        child_process.execSync(`django-admin startproject ${projectName}`, { cwd: workspaceFolder });
        vscode.window.showInformationMessage(`Django project '${projectName}' created successfully!`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create the Django project '${projectName}'.`);
        return;
    }

    // Step 3: Create the app
    const projectDir = path.join(workspaceFolder, projectName);
    if (appName) {
        try {
            child_process.execSync(`python manage.py startapp ${appName}`, { cwd: projectDir });
            vscode.window.showInformationMessage(`Django app '${appName}' created successfully in '${projectName}'!`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create the Django app '${appName}'.`);
            return;
        }
    }

    // Step 4: Prompt to set up static files
    const setupStatic = await vscode.window.showQuickPick(['Yes', 'No'], {
        placeHolder: 'Do you want to set up static files in settings.py?',
    });

    if (setupStatic === 'Yes') {
        setupStaticConfiguration(workspaceFolder, projectName);
    } else {
        vscode.window.showInformationMessage('Static files setup skipped.');
    }
}

// Activation function for the extension
export function activate(context: vscode.ExtensionContext) {
    console.log('Workspace Configuration Assistant for Django is now active!');

    // Register "Setup Django Workspace" command
    let setupWorkspaceCmd = vscode.commands.registerCommand('workspaceConfigAssistant.setupDjangoWorkspace', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : '';
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('Please open a folder before running this command.');
            return;
        }

        const projectName = await vscode.window.showInputBox({
            placeHolder: 'Enter the Django project name',
            validateInput: (value: string) => {
                if (!value) return 'Project name is required';
                if (fs.existsSync(path.join(workspaceFolder, value))) return 'Project already exists';
                return null;
            }
        });

        if (!projectName) {
            vscode.window.showErrorMessage('No project name entered!');
            return;
        }

        const appName = await vscode.window.showInputBox({
            placeHolder: 'Enter the Django app name',
            validateInput: (value: string) => {
                if (value && !/^[a-zA-Z0-9_]+$/.test(value)) return 'App name should contain only letters, numbers, or underscores';
                return null;
            }
        }) || '';

        setupDjangoWorkspace(workspaceFolder, projectName, appName);
    });

    context.subscriptions.push(setupWorkspaceCmd);
}

// Deactivation function
export function deactivate() {}
