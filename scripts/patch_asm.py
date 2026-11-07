import re, sys, os
path = "/tmp/Dobby/source/TrampolineBridge/ClosureTrampolineBridge/arm64/closure_bridge_arm64.asm"
if not os.path.exists(path):
    print("ASM not found")
    sys.exit(0)
with open(path) as f:
    c = f.read()
c = re.sub(r'(adrp\s+\w+,\s+)(\w+)@PAGE', r'\1\2', c)
c = re.sub(r'(add\s+\w+,\s+\w+,\s+)(\w+)@PAGEOFF', r'\1:lo12:\2', c)
with open(path, 'w') as f:
    f.write(c)
print("ASM patched OK")
