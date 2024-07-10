'use strict';
import { window, ExtensionContext, StatusBarAlignment, StatusBarItem, workspace, WorkspaceConfiguration } from 'vscode';
const { XMLParser} = require("fast-xml-parser");

const xml_parser = new XMLParser();
const exec = require("child-process-promise").exec;
const nvidia_cmd = `nvidia-smi -q -x`;

export function activate(context: ExtensionContext) {
    var resourceMonitor: ResMon = new ResMon();
    resourceMonitor.StartUpdating();
    context.subscriptions.push(resourceMonitor);
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
        let res_xml = null;
        let disp_str = 'nvmonErr';

        try {
            res_xml = await exec(nvidia_cmd, { timeout: 2000 });
        } catch (error) {
            console.error('Error getting results from nvidia-smi. Error: ', error);
        }

        if (res_xml == null) {
            return disp_str
        }

        let res = xml_parser.parse(res_xml.stdout).nvidia_smi_log;
        let N_gpu = res['attached_gpus'];
        if (N_gpu == 1) {
            res.gpu = [res.gpu];
        }
        
        let show_sum = this._config.get('showSum', false);
        if (show_sum) {
            let gpu_util_sum = 0;
            let mem_used_sum = 0;
            let mem_total_sum = 0;
            let temp_current_sum = 0;
            let temp_target_sum = 0;
            for (let gpu_i = 0; gpu_i < N_gpu; gpu_i++) {
                gpu_util_sum += parseInt(res.gpu[gpu_i].utilization.gpu_util.replace(' %', ''));
                mem_used_sum += Math.round(res.gpu[gpu_i].fb_memory_usage.used.replace(' MiB', '')/1024);
                mem_total_sum += Math.round(res.gpu[gpu_i].fb_memory_usage.total.replace(' MiB', '')/1024);
                temp_current_sum += Math.round(res.gpu[gpu_i].temperature.gpu_temp.replace(' C', ''));
                temp_target_sum += Math.round(res.gpu[gpu_i].temperature.gpu_target_temperature.replace(' C', ''));
            }
            temp_current_sum = Math.round(temp_current_sum/N_gpu);
            temp_target_sum = Math.round(temp_target_sum/N_gpu);
            let gpu_util_sum_str = gpu_util_sum.toString().padStart(3, ' ');
            let mem_used_sum_str = mem_used_sum.toString().padStart(3, ' ');
            disp_str = `⚡️GPU: ${gpu_util_sum_str}%・${mem_used_sum_str}/${mem_total_sum}G・${temp_current_sum}/${temp_target_sum}°C'`;
        }
        else {
            const disp_arr: string[] = [];
            for (let gpu_i = 0; gpu_i < N_gpu; gpu_i++) {
                res.gpu[gpu_i].utilization.gpu_util = res.gpu[gpu_i].utilization.gpu_util.replace(' %', '');

                // pading ' ' doesn't work, the string has same number of chars, but display result depends on text font.
                const gpu_util = parseInt(res.gpu[gpu_i].utilization.gpu_util.replace(' %', '')).toString().padStart(3, ' ');
                const mem_used = Math.round(res.gpu[gpu_i].fb_memory_usage.used.replace(' MiB', '')/1024).toString().padStart(2, ' ');
                const mem_total = Math.round(res.gpu[gpu_i].fb_memory_usage.total.replace(' MiB', '')/1024);
                const temp_current = Math.round(res.gpu[gpu_i].temperature.gpu_temp.replace(' C', ''));
                const temp_target = Math.round(res.gpu[gpu_i].temperature.gpu_target_temperature.replace(' C', ''));

                let str_i = `⚡️G${gpu_i}: ${gpu_util}%・${mem_used}/${mem_total}G・${temp_current}/${temp_target}°C`;
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
