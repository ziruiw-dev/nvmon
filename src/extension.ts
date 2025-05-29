'use strict';
import { window, ExtensionContext, StatusBarAlignment, StatusBarItem, workspace, WorkspaceConfiguration, OutputChannel } from 'vscode';
import { XMLParser } from "fast-xml-parser";
import execa = require("execa");
import * as path from 'path';

const xml_parser = new XMLParser();
let python_cmd = 'python';
let python_args: string[] = [];
let useNvidiaSmi = false;
let outputChannel: OutputChannel;

// Error state tracking to prevent log flooding
let isInErrorState = false;


async function checkDependencies(): Promise<boolean> {
    outputChannel.appendLine('\n--- Checking GPU Monitoring Dependencies ---');
    
    // Try PyNVML first (preferred method)
    outputChannel.appendLine('🔍 Checking PyNVML availability...');
    const pyNVMLResult = await tryPyNVML();
    
    if (pyNVMLResult) {
        outputChannel.appendLine('✅ Using PyNVML for GPU monitoring (optimal performance)');
        return true;
    }
    
    // Try nvidia-smi as fallback
    outputChannel.appendLine('🔍 PyNVML not available, checking nvidia-smi fallback...');
    const nvidiaSmiResult = await tryNvidiaSmi();
    
    if (nvidiaSmiResult) {
        useNvidiaSmi = true;
        outputChannel.appendLine('✅ Using nvidia-smi for GPU monitoring (fallback mode)');
        
        // Offer PyNVML installation even when nvidia-smi works (since PyNVML is preferred)
        const pythonAvailable = await checkPythonOnly();
        const dontAsk = workspace.getConfiguration('nvidiaMonitor').get('suppressInstallPrompts', false);
        
        if (pythonAvailable && !dontAsk) {
            outputChannel.appendLine('💡 Python detected - offering PyNVML upgrade for better performance');
            const promptMessage = 'GPU monitoring is working with nvidia-smi. Install PyNVML for better performance?';
            const option1 = 'Install PyNVML';
            const option2 = 'Keep Current Setup';
            const option3 = 'Don\'t Ask Again';
            
            outputChannel.appendLine(`📋 Showing user prompt: "${promptMessage}"`);
            outputChannel.appendLine(`📋 Available options: ["${option1}", "${option2}", "${option3}"]`);
            
            window.showInformationMessage(promptMessage, option1, option2, option3).then(selection => {
                if (selection) {
                    outputChannel.appendLine(`✅ User clicked: "${selection}"`);
                    if (selection === option1) {
                        outputChannel.appendLine('🚀 User chose to install PyNVML - proceeding with installation');
                        attemptPyNVMLInstall();
                    } else if (selection === option2) {
                        outputChannel.appendLine('ℹ️ User chose to keep current nvidia-smi setup');
                    } else if (selection === option3) {
                        outputChannel.appendLine('🔕 User chose to stop future installation prompts');
                        workspace.getConfiguration('nvidiaMonitor').update('suppressInstallPrompts', true, 1);
                    }
                } else {
                    outputChannel.appendLine('❌ User dismissed prompt without selection');
                }
            });
        } else if (pythonAvailable && dontAsk) {
            outputChannel.appendLine('🔕 Python available but user chose not to be asked about PyNVML installation');
        } else {
            outputChannel.appendLine('ℹ️ Python not available for PyNVML upgrade');
        }
        
        return true;
    }
    
    // Neither method available
    outputChannel.appendLine('❌ Neither PyNVML nor nvidia-smi is available');
    const errorMessage = 'GPU monitoring unavailable. Please install Python with PyNVML or ensure nvidia-smi is in PATH.';
    const errorOption1 = 'Install PyNVML';
    const errorOption2 = 'Learn More';
    
    outputChannel.appendLine(`📋 Showing error prompt: "${errorMessage}"`);
    outputChannel.appendLine(`📋 Available options: ["${errorOption1}", "${errorOption2}"]`);
    
    window.showErrorMessage(errorMessage, errorOption1, errorOption2).then(selection => {
        if (selection) {
            outputChannel.appendLine(`✅ User clicked: "${selection}"`);
            if (selection === errorOption1) {
                outputChannel.appendLine('🚀 User chose to install PyNVML from error dialog - proceeding with installation');
                attemptPyNVMLInstall();
            } else if (selection === errorOption2) {
                outputChannel.appendLine('📖 User chose Learn More - showing additional information');
                const learnMoreMessage = 'This extension requires either PyNVML (preferred) or nvidia-smi. PyNVML provides better performance and reliability.';
                outputChannel.appendLine(`📋 Showing info dialog: "${learnMoreMessage}"`);
                window.showInformationMessage(learnMoreMessage);
            }
        } else {
            outputChannel.appendLine('❌ User dismissed error prompt without selection');
        }
    });
    
    return false;
}

async function tryPyNVML(): Promise<boolean> {
    try {
        const cmd = 'python';
        outputChannel.appendLine(`  📋 Trying Python command: ${cmd}`);
        
        // Check Python version
        const { stdout: pythonVersion } = await execa(cmd, ['--version']);
        outputChannel.appendLine(`  ✅ Python found: ${pythonVersion.trim()}`);
        
        // Check if PyNVML is installed
        await execa(cmd, ['-c', 'import pynvml']);
        outputChannel.appendLine(`  ✅ PyNVML import successful`);
        
        python_cmd = cmd;
        return true;
    } catch (error) {
        outputChannel.appendLine(`  ❌ python failed: ${error}`);
        return false;
    }
}

async function tryNvidiaSmi(): Promise<boolean> {
    try {
        outputChannel.appendLine(`  📋 Testing nvidia-smi command...`);
        const result = await execa('nvidia-smi', ['-q', '-x'], { timeout: 5000 });
        outputChannel.appendLine(`  ✅ nvidia-smi working (output length: ${result.stdout.length} chars)`);
        return true;
    } catch (error) {
        outputChannel.appendLine(`  ❌ nvidia-smi failed: ${error}`);
        return false;
    }
}

async function checkPythonOnly(): Promise<boolean> {
    try {
        outputChannel.appendLine(`  📋 Checking python availability...`);
        const { stdout: pythonVersion } = await execa('python', ['--version']);
        outputChannel.appendLine(`  ✅ Found: ${pythonVersion.trim()}`);
        return true;
    } catch (error) {
        outputChannel.appendLine(`  ❌ python not available`);
        return false;
    }
}

async function checkPipAvailability(): Promise<boolean> {
    try {
        outputChannel.appendLine(`  📋 Checking pip availability...`);
        const { stdout } = await execa('pip', ['--version']);
        outputChannel.appendLine(`  ✅ Found: ${stdout.trim()}`);
        return true;
    } catch (error) {
        outputChannel.appendLine(`  ❌ pip not available`);
        return false;
    }
}

async function attemptPyNVMLInstall(): Promise<void> {
    outputChannel.appendLine('\n--- Attempting PyNVML Installation ---');
    
    // First check if pip is available
    outputChannel.appendLine('🔍 Checking pip availability...');
    const pipAvailable = await checkPipAvailability();
    
    if (!pipAvailable) {
        const noPipMessage = 'Cannot install PyNVML: pip not found. Please install pip first.';
        outputChannel.appendLine(`❌ ${noPipMessage}`);
        outputChannel.appendLine(`📋 Showing error message: "${noPipMessage}"`);
        window.showErrorMessage(noPipMessage);
        return;
    }
    
    try {
        const installCommand = 'pip install pynvml';
        outputChannel.appendLine(`📦 Executing command: ${installCommand}`);
        outputChannel.appendLine('⏳ Installation in progress...');
        
        const result = await execa('pip', ['install', 'pynvml']);
        
        outputChannel.appendLine(`✅ pip exit code: 0`);
        outputChannel.appendLine(`📋 pip stdout: ${result.stdout}`);
        if (result.stderr) {
            outputChannel.appendLine(`📋 pip stderr: ${result.stderr}`);
        }
        
        const successMessage = 'PyNVML installed successfully. Please reload VS Code to use the improved GPU monitoring.';
        outputChannel.appendLine(`📋 Showing success message: "${successMessage}"`);
        window.showInformationMessage(successMessage);
        
    } catch (error: any) {
        outputChannel.appendLine(`❌ pip installation failed with exit code: ${error?.exitCode || 'unknown'}`);
        outputChannel.appendLine(`❌ Error message: ${error?.message || 'Unknown error'}`);
        if (error?.stdout) {
            outputChannel.appendLine(`📋 Error stdout: ${error.stdout}`);
        }
        if (error?.stderr) {
            outputChannel.appendLine(`📋 Error stderr: ${error.stderr}`);
        }
        
        const errorMessage = `Failed to install PyNVML: ${error?.message || 'Unknown error'}. Falling back to nvidia-smi if available.`;
        outputChannel.appendLine(`📋 Showing error message: "${errorMessage}"`);
        window.showErrorMessage(errorMessage);
    }
}

export async function activate(context: ExtensionContext) {
    // Create output channel for logging
    outputChannel = window.createOutputChannel('Nvidia Monitor');
    context.subscriptions.push(outputChannel);
    
    outputChannel.appendLine('=== Nvidia Monitor Extension Starting ===');
    outputChannel.appendLine(`Extension path: ${context.extensionPath}`);
    
    // Check dependencies first
    const dependenciesOk = await checkDependencies();
    if (!dependenciesOk) {
        outputChannel.appendLine('❌ Dependency check failed - extension will not start');
        return;
    }

    // Set up the Python script path
    const scriptPath = path.join(context.extensionPath, 'src', 'gpu_info.py');
    python_args = [scriptPath];
    outputChannel.appendLine(`Python script path: ${scriptPath}`);
    
    var resourceMonitor: ResMon = new ResMon();
    resourceMonitor.StartUpdating();
    context.subscriptions.push(resourceMonitor);
    
    outputChannel.appendLine('✅ Nvidia Monitor extension activated successfully');
}

abstract class Resource {
    public _config: WorkspaceConfiguration;
    protected _isShownByDefault: boolean;
    protected _configKey: string;
    protected _maxWidth: number;

    constructor(config: WorkspaceConfiguration, isShownByDefault: boolean, configKey: string) {
        this._config = config;
        this._isShownByDefault = isShownByDefault;
        this._configKey = configKey;
        this._maxWidth = 0;
    }

    public async getResourceDisplay(): Promise<string | null> {
        if (await this.isShown())
        {
            let display: string = await this.getDisplay();
            this._maxWidth = Math.max(this._maxWidth, display.length);

            // Pad out to the correct length such that the length doesn't change
            return display.padEnd(this._maxWidth, ' ');
        }
        return null;
    }

    protected abstract getDisplay(): Promise<string>;

    protected async isShown(): Promise<boolean> {
        return Promise.resolve(this._config.get(`show.${this._configKey}`, true));
    }
}

class GpuUsage extends Resource {
    constructor(config: WorkspaceConfiguration) {
        super(config, true, "gpuusage");
    }

    async getDisplay(): Promise<string> {
        if (useNvidiaSmi) {
            return this.getDisplayFromNvidiaSmi();
        } else {
            return this.getDisplayFromPyNVML();
        }
    }
    
    async getDisplayFromPyNVML(): Promise<string> {
        let res_json = null;
        let disp_str = 'nvmonErr (unknown)';

        try {
            const timeout = this._config.get('commandTimeoutMs', 2000);
            const { stdout } = await execa(python_cmd, python_args, { timeout });
            res_json = { stdout };
        } catch (error) {
            disp_str = 'nvmonErr (timeout)';
            if (!isInErrorState) {
                outputChannel.appendLine(`❌ PyNVML error: ${error}`);
                isInErrorState = true;
            }
        }

        if (res_json == null) {
            if (!isInErrorState) {
                outputChannel.appendLine(`⚠️ Returning error display: ${disp_str}`);
            }
            return disp_str
        }

        try {
            let res = JSON.parse(res_json.stdout).nvidia_smi_log;
            const formattedData = this.formatGpuData(res);
            if (isInErrorState) {
                outputChannel.appendLine(`✅ PyNVML recovered successfully`);
                isInErrorState = false;
            }
            return formattedData;
        } catch (parseError) {
            if (!isInErrorState) {
                outputChannel.appendLine(`❌ JSON parsing error: ${parseError}`);
                isInErrorState = true;
            }
            return 'nvmonErr (parse)';
        }
    }
    
    async getDisplayFromNvidiaSmi(): Promise<string> {
        let res_xml = null;
        let disp_str = 'nvmonErr (unknown)';

        try {
            const timeout = this._config.get('commandTimeoutMs', 2000);
            const { stdout } = await execa('nvidia-smi', ['-q', '-x'], { timeout });
            res_xml = { stdout };
        } catch (error) {
            disp_str = 'nvmonErr (timeout)';
            if (!isInErrorState) {
                outputChannel.appendLine(`❌ nvidia-smi error: ${error}`);
                isInErrorState = true;
            }
        }

        if (res_xml == null) {
            if (!isInErrorState) {
                outputChannel.appendLine(`⚠️ Returning error display: ${disp_str}`);
            }
            return disp_str
        }

        try {
            let res = xml_parser.parse(res_xml.stdout).nvidia_smi_log;
            const formattedData = this.formatGpuData(res);
            if (isInErrorState) {
                outputChannel.appendLine(`✅ nvidia-smi recovered successfully`);
                isInErrorState = false;
            }
            return formattedData;
        } catch (parseError) {
            if (!isInErrorState) {
                outputChannel.appendLine(`❌ XML parsing error: ${parseError}`);
                isInErrorState = true;
            }
            return 'nvmonErr (parse)';
        }
    }
    
    formatGpuData(res: any): string {
        let N_gpu = res['attached_gpus'];
        if (N_gpu == 1) {
            res.gpu = [res.gpu];
        }
        
        let show_sum = this._config.get('showSum', false);
        let disp_str = '';
        
        if (show_sum) {
            let gpu_util_sum = 0;
            let mem_used_sum = 0;
            let mem_total_sum = 0;
            for (let gpu_i = 0; gpu_i < N_gpu; gpu_i++) {
                gpu_util_sum += parseInt(res.gpu[gpu_i].utilization.gpu_util.replace(' %', ''));
                mem_used_sum += Math.round(res.gpu[gpu_i].fb_memory_usage.used.replace(' MiB', '')/1024);
                mem_total_sum += Math.round(res.gpu[gpu_i].fb_memory_usage.total.replace(' MiB', '')/1024);
            }
            let gpu_util_sum_str = gpu_util_sum.toString().padStart(3, '~');
            let mem_used_sum_str = mem_used_sum.toString().padStart(3, '~');
            disp_str = `⚡️GPU: ${gpu_util_sum_str}%・${mem_used_sum_str}/${mem_total_sum}G`;
        }
        else {
            const disp_arr: string[] = [];
            for (let gpu_i = 0; gpu_i < N_gpu; gpu_i++) {
                res.gpu[gpu_i].utilization.gpu_util = res.gpu[gpu_i].utilization.gpu_util.replace(' %', '');

                // pading ' ' doesn't work, the string has same number of chars, but display result depends on text font.
                const gpu_util = parseInt(res.gpu[gpu_i].utilization.gpu_util.replace(' %', '')).toString().padStart(3, '~');
                const mem_used = Math.round(res.gpu[gpu_i].fb_memory_usage.used.replace(' MiB', '')/1024).toString().padStart(2, '~');
                const mem_total = Math.round(res.gpu[gpu_i].fb_memory_usage.total.replace(' MiB', '')/1024);

                let str_i = `⚡️G${gpu_i}: ${gpu_util}%・${mem_used}/${mem_total}G`;
                disp_arr.push(str_i);
            }
            disp_str = disp_arr.join('  ');
        }
        return disp_str;
    }
}

class ResMon {
    private _statusBarItem: StatusBarItem;
    private _config: WorkspaceConfiguration;
    private _delimiter: string;
    private _updating: boolean;
    private _resources: Resource[];

    constructor() {
        this._config = workspace.getConfiguration('nvidiaMonitor');
        this._delimiter = "    ";
        this._updating = false;
        this._statusBarItem = window.createStatusBarItem(this._config.get('alignLeft') ? StatusBarAlignment.Left : StatusBarAlignment.Right);
        this._statusBarItem.show();

        // Add all resources to monitor
        this._resources = [];
        this._resources.push(new GpuUsage(this._config));
    }

    public StartUpdating() {
        this._updating = true;
        this.update();
    }

    public StopUpdating() {
        this._updating = false;
    }
    
    private async update() {
        if (this._updating) {

            // Update the configuration in case it has changed
            this._config = workspace.getConfiguration('nvidiaMonitor');
            for (let resource of this._resources) {
                resource._config = this._config;
            }

            // Update the status bar item's styling
            let proposedAlignment = this._config.get('alignLeft') ? StatusBarAlignment.Left : StatusBarAlignment.Right;
            if (proposedAlignment !== this._statusBarItem.alignment) {
                this._statusBarItem.dispose();
                this._statusBarItem = window.createStatusBarItem(proposedAlignment);
                this._statusBarItem.show();
            }

            // Get the display of the requested resources
            let pendingUpdates: Promise<string | null>[] = this._resources.map(resource => resource.getResourceDisplay());

            // Wait for the resources to update
            this._statusBarItem.text = await Promise.all(pendingUpdates).then(finishedUpdates => {
                // Remove nulls, join with delimiter
                return finishedUpdates.filter(update => update !== null).join(this._delimiter);
            });

            setTimeout(() => this.update(), this._config.get('updateFrequencyMs', 500));
        }
    }

    dispose() {
        this.StopUpdating();
        this._statusBarItem.dispose();
    }
}

export function deactivate() {
}
