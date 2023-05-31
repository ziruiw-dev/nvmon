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
- `updateFrequencyms`: How frequently to query systeminformation. The minimum is 200 ms as to prevent accidentally updating so fast as to freeze up your machine.
- `alignLeft`: Toggles the alignment of the status bar.
- `color`: Color of the status bar text in hex code (for example, #FFFFFF is white). The color must be in the format #RRGGBB, using hex digits.

## Known Issues
- ~~This plug-in might freeze occationally. Reload window should fix it for now (In vscode press `Ctrl/Cmd` + `Shift` + `p` to call command platte and type `reload`). Will dig into this later.~~

## TODO
- [x] Fix plug-in frozen issue.
- [ ] Update packages and dependencies to modern versions.

## Change Log
- 2023.05.14 - Initial release
- 2023.07.05 - Get rid of a bug that causes the plug-in to freeze.

## Acknowledgements
This toy is built on top of the amazing tool [resource monitor](https://github.com/Njanderson/resmon).
