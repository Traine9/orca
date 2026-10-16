# Build image for the fork's Android APK: Debian trixie (the host's glibc, so host-installed
# node_modules natives run), Node 24, JDK 17. The Android SDK is bind-mounted, not baked in.
FROM eclipse-temurin:17-jdk AS jdk
FROM node:24-trixie
COPY --from=jdk /opt/java/openjdk /opt/java/openjdk
ENV JAVA_HOME=/opt/java/openjdk \
    PATH=/opt/java/openjdk/bin:$PATH \
    ANDROID_HOME=/opt/android-sdk \
    ANDROID_SDK_ROOT=/opt/android-sdk \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
