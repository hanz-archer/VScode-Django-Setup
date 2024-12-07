import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

// This function sets up the Django workspace based on user input
async function setupDjangoWorkspace(workspaceFolder: string, projectName: string, appName: string) {
    // Step 1: Check if Python is installed
    try {
        child_process.execSync('python --version', { stdio: 'ignore' }); // Just check for Python version
    } catch (error) {
        vscode.window.showErrorMessage('Python is not installed or not added to PATH. Please fix this before proceeding.');
        return;
    }

    // Step 2: Create Django project
    const projectPath = path.join(workspaceFolder, projectName);

    // Check if project folder already exists
    if (fs.existsSync(projectPath)) {
        vscode.window.showErrorMessage(`The project folder ${projectName} already exists.`);
        return;
    }

    try {
        // Create the Django project
        child_process.execSync(`django-admin startproject ${projectName}`, { cwd: workspaceFolder });
        vscode.window.showInformationMessage(`Django project '${projectName}' created successfully!`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create the Django project '${projectName}'.`);
        return;
    }

    // Step 3: Navigate into the project directory and create the app
    const projectDir = path.join(workspaceFolder, projectName);

    if (appName) {
        try {
            // Create the Django app
            child_process.execSync(`python manage.py startapp ${appName}`, { cwd: projectDir });
            vscode.window.showInformationMessage(`Django app '${appName}' created successfully in '${projectName}'!`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create the Django app '${appName}'.`);
            return;
        }
    }

    // Step 4: Set up virtual environment for Django
    try {
        child_process.execSync('python -m venv venv', { cwd: projectDir });
        child_process.execSync('pip install -r requirements.txt', { cwd: projectDir });
    } catch (error) {
        vscode.window.showErrorMessage('Failed to set up the virtual environment.');
        return;
    }

    // Step 5: Create requirements.txt file for dependencies
    const requirements = [
        "Django==3.2.6",
        "djangorestframework==3.12.4"
    ];

    try {
        fs.writeFileSync(path.join(projectDir, 'requirements.txt'), requirements.join('\n'));
    } catch (error) {
        vscode.window.showErrorMessage('Failed to create the requirements.txt file.');
        return;
    }

    // Step 6: Create VSCode settings for Python
    const vscodeFolder = path.join(projectDir, '.vscode');
    fs.mkdirSync(vscodeFolder, { recursive: true });
    const settings = {
        "python.pythonPath": "venv/bin/python",
        "python.linting.enabled": true,
        "python.linting.pylintEnabled": true,
        "python.formatting.autopep8Path": "autopep8"
    };

    try {
        fs.writeFileSync(path.join(vscodeFolder, 'settings.json'), JSON.stringify(settings, null, 2));
    } catch (error) {
        vscode.window.showErrorMessage('Failed to create VSCode settings.');
        return;
    }

    vscode.window.showInformationMessage(`Django workspace for project '${projectName}' is set up!`);
}

// Activation function for the extension
export function activate(context: vscode.ExtensionContext) {
    console.log('Workspace Configuration Assistant for Django is now active!');

    let disposable = vscode.commands.registerCommand('workspaceConfigAssistant.setupDjangoWorkspace', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : '';
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('Please open a folder before running this command.');
            return;
        }

        // Step 1: Ask for the project name
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

        // Step 2: Ask for the app name (optional)
        const appName = await vscode.window.showInputBox({
            placeHolder: 'Enter the Django app name',
            validateInput: (value: string) => {
                if (value && !/^[a-zA-Z0-9_]+$/.test(value)) return 'App name should contain only letters, numbers, or underscores';
                return null;
            }
        }) || ''; // Default to an empty string if undefined

        // Step 3: Set up the Django workspace with the provided names
        setupDjangoWorkspace(workspaceFolder, projectName, appName);
    });

    context.subscriptions.push(disposable);
}

// Deactivation function
export function deactivate() {}
