import os
stub = (
    "\n#include <sys/mman.h>\n"
    "#include <unistd.h>\n"
    "#ifndef OSMEMORY_STUB\n"
    "#define OSMEMORY_STUB\n"
    "struct OSMemory {\n"
    "  static size_t PageSize() { return sysconf(_SC_PAGESIZE); }\n"
    "  static bool SetPermission(void* addr, size_t len, int prot)"
    " { return mprotect(addr, len, prot) == 0; }\n"
    "};\n"
    "static const int kReadExecute = PROT_READ | PROT_EXEC;\n"
    "#endif\n"
)
for p in [
    "/tmp/Dobby/common/os_arch_features.h",
    "/tmp/Dobby/source/Backend/UserMode/UnifiedInterface/platform-posix.cc",
]:
    if not os.path.exists(p):
        print("SKIP:", p)
        continue
    with open(p) as f:
        c = f.read()
    if "OSMEMORY_STUB" in c:
        print("Already done:", p)
        continue
    with open(p, 'w') as f:
        f.write(stub + c)
    print("Patched:", p)
