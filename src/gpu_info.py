#!/usr/bin/env python3
import pynvml
import json
import sys

def get_gpu_info():
    try:
        pynvml.nvmlInit()
        device_count = pynvml.nvmlDeviceGetCount()
        
        gpus = []
        for i in range(device_count):
            handle = pynvml.nvmlDeviceGetHandleByIndex(i)
            
            # Get GPU utilization
            utilization = pynvml.nvmlDeviceGetUtilizationRates(handle)
            gpu_util = utilization.gpu
            
            # Get memory info
            memory = pynvml.nvmlDeviceGetMemoryInfo(handle)
            mem_used = memory.used // (1024 * 1024)  # Convert to MiB
            mem_total = memory.total // (1024 * 1024)  # Convert to MiB
            
            gpus.append({
                'utilization': {'gpu_util': f'{gpu_util} %'},
                'fb_memory_usage': {
                    'used': f'{mem_used} MiB',
                    'total': f'{mem_total} MiB'
                }
            })
        
        result = {
            'nvidia_smi_log': {
                'attached_gpus': device_count,
                'gpu': gpus[0] if device_count == 1 else gpus
            }
        }
        
        print(json.dumps(result))
        return 0
        
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        return 1
    finally:
        try:
            pynvml.nvmlShutdown()
        except:
            pass

if __name__ == '__main__':
    sys.exit(get_gpu_info()) 