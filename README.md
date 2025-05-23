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
- `updateFrequencyMs`: How frequently to query systeminformation. The minimum is 200 ms as to prevent accidentally updating so fast as to freeze up your machine.
- `alignLeft`: Toggles the alignment of the status bar.
- `commandTimeoutMs`: Timeout in milliseconds for the GPU info command (default: 2000ms, min: 100ms, max: 5000ms). If the command takes longer than this, it will be considered failed and show a timeout error.

## Known Issues
- ~~This plug-in might freeze occationally. Reload window should fix it for now (In vscode press `Ctrl/Cmd` + `Shift` + `p` to call command platte and type `reload`). Will dig into this later.~~
- The plugin could not be installed properly on Windows and some Linux systems when `pip` is unavailable. This happens in version 25.5.5 update. If you have this issue, please manually install version 25.5.2 (see issue #5). Will get it fixed by 30 May.

## TODO
- [x] Fix plug-in frozen issue.
- [x] Automatic change text colour based on status bar colour.
- [x] Update packages to modern versions.
- [x] Switch to PyNVML for better performance.
- [ ] Add an option to show selected GPUs only.
- [ ] Add an option to show temperature.
- [ ] Add back the option to customise font colour.
- [ ] Make icon configurable.

## Change Log
- 2023.05.14 - Initial release
- 2023.07.05 - Get rid of a bug that causes the plug-in to freeze.
- 2023.07.06 - Automatic change text colour based on status bar colour.
- 2025.03.13 - Update dependencies to modern versions.
- 2025.05.02 - Add configurable timeout for nvidia-smi command and improve error messages.
- 2025.05.03 - Switch from nvidia-smi to PyNVML for better performance and reliability.

## Acknowledgements
This toy is built on top of the amazing tool [resource monitor](https://github.com/Njanderson/resmon).
