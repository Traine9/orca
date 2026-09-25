# Source this to build the Android APK with the user-local JDK and SDK (cc-tabdiff mod).
# Only exports paths; override JAVA_HOME / ANDROID_HOME before sourcing to use other installs.
export JAVA_HOME="${JAVA_HOME:-$HOME/.local/jdk-17}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
