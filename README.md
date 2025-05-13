# Nvidia Monitor
Display GPU utilisation and memory consumption in vscode status bar.

## Screenshots
Single GPU:

![Single GPU](images/single_gpu.png)

Multi GPU:

![Multi GPU](images/multi_gpu.png)

Multi GPU sum:

![Multi GPU Sum](images/multi_gpu_sum.png)

## Extension Settings
- `showSum`: Toggles the display of the sum of all GPUs. This is useful when you have so many GPUs and want to see the total usage in a compact way.
- `updateFrequencyMs`: How frequently to query GPU information. The minimum is 100 ms, maximum is 5000 ms (default: 500ms).
- `alignLeft`: Toggles the alignment of the status bar.
- `commandTimeoutMs`: Timeout in milliseconds for the GPU info command (default: 2000ms, min: 100ms, max: 5000ms). If the command takes longer than this, it will be considered failed and show a timeout error.
- `suppressInstallPrompts`: When set to true, stops prompting for PyNVML installation (set automatically when user clicks "Don't Ask Again").

## Architecture

This extension uses a fallback system for GPU monitoring:

1. **PyNVML (Preferred)**: Uses Python with the `pynvml` library for optimal performance and reliability
2. **nvidia-smi (Fallback)**: Falls back to `nvidia-smi` command when PyNVML is unavailable

### Automatic Installation Flow
- Extension checks for PyNVML availability on startup
- If unavailable but `python` and `pip` are detected, offers to install PyNVML automatically
- Users can choose "Install PyNVML", "Keep Current Setup", or "Don't Ask Again"
- Comprehensive logging available in VS Code Output Channel (View → Output → "Nvidia Monitor")

## Known Issues
- ~~This plug-in might freeze occationally. Reload window should fix it for now (In vscode press `Ctrl/Cmd` + `Shift` + `p` to call command platte and type `reload`). Will dig into this later.~~
- ~~The plugin could not be installed properly on Windows and some Linux systems when `pip` is unavailable. This happens in version 25.5.5 update. If you have this issue, please manually install version 25.5.2 (see issue #5). Will get it fixed by 30 May. (Fixed in 25.5.28)~~

## TODO
- [x] Fix plug-in frozen issue.
- [x] Automatic change text colour based on status bar colour.
- [x] Update packages to modern versions.
- [x] Switch to PyNVML for better performance.
- [ ] Add an option to show selected GPUs only.
- [ ] Add an option to show temperature.
- [ ] Add back the option to customise font colour.
- [ ] Make icon configurable.

## Acknowledgements
This toy is built on top of the amazing tool [resource monitor](https://github.com/Njanderson/resmon).
