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

// Function to set up index.html, views.py, and urls.py
async function setupIndexHtml(workspaceFolder: string, projectName: string, appName: string) {
    const appDir = path.join(workspaceFolder, projectName, appName);

    try {
        // Create a templates folder and index.html
        const templatesDir = path.join(appDir, 'templates', appName);
        fs.mkdirSync(templatesDir, { recursive: true });

        const indexHtmlPath = path.join(templatesDir, 'index.html');
        const indexHtmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to ${appName}</title>
</head>
<body>
    <h1>Hello from ${appName}!</h1>
</body>
</html>
        `;
        fs.writeFileSync(indexHtmlPath, indexHtmlContent, 'utf8');

        // Update views.py
        const viewsFilePath = path.join(appDir, 'views.py');
        const viewsContent = `
from django.shortcuts import render

def index(request):
    return render(request, '${appName}/index.html')
        `;
        fs.writeFileSync(viewsFilePath, viewsContent, 'utf8');

        // Update urls.py
        const urlsFilePath = path.join(appDir, 'urls.py');
        const urlsContent = `
from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
]
        `;
        fs.writeFileSync(urlsFilePath, urlsContent, 'utf8');

        // Register the app's urls.py in the project's urls.py
        const projectUrlsFilePath = path.join(workspaceFolder, projectName, projectName, 'urls.py');
        let projectUrlsContent = fs.readFileSync(projectUrlsFilePath, 'utf8');
        if (!projectUrlsContent.includes(`include('${appName}.urls')`)) {
            projectUrlsContent = projectUrlsContent.replace(
                'urlpatterns = [',
                `from django.urls import include\n\nurlpatterns = [\n    path('${appName}/', include('${appName}.urls')),`
            );
            fs.writeFileSync(projectUrlsFilePath, projectUrlsContent, 'utf8');
        }

        vscode.window.showInformationMessage('index.html, views.py, and urls.py have been set up.');
    } catch (error) {
        vscode.window.showErrorMessage('Failed to set up index.html, views.py, and urls.py.');
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

    // Step 4: Prompt user for static files setup
    const setupStatic = await vscode.window.showQuickPick(
        ['Yes', 'No'],
        {
            placeHolder: 'Do you want to set up static files in settings.py?',
            ignoreFocusOut: true,
        }
    );

    if (setupStatic === 'Yes') {
        await setupStaticConfiguration(workspaceFolder, projectName);
    } else if (setupStatic === 'No') {
        vscode.window.showInformationMessage('Static files setup skipped.');
    }

    // Step 5: Prompt user for index.html, views, and urls setup
    const setupIndex = await vscode.window.showQuickPick(
        ['Yes', 'No'],
        {
            placeHolder: 'Do you want to set up index.html, views.py, and urls.py for your app?',
            ignoreFocusOut: true,
        }
    );

    if (setupIndex === 'Yes') {
        await setupIndexHtml(workspaceFolder, projectName, appName);
    } else if (setupIndex === 'No') {
        vscode.window.showInformationMessage('Index, views, and urls setup skipped.');
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
