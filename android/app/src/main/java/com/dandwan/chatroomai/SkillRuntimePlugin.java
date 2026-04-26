package com.dandwan.chatroomai;

import android.Manifest;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationManager;
import android.os.Build;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import androidx.core.content.ContextCompat;
import java.io.BufferedReader;
import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "SkillRuntime")
public class SkillRuntimePlugin extends Plugin {
    private final ExecutorService ioExecutor = Executors.newCachedThreadPool();

    @PluginMethod
    public void preparePath(PluginCall call) {
        execute(() -> {
            try {
                String relativePath = call.getString("relativePath");
                if (relativePath == null || relativePath.trim().isEmpty()) {
                    call.reject("relativePath is required");
                    return;
                }

                File root = resolveAppRelativePath(relativePath);
                if (!root.exists()) {
                    call.reject("Path does not exist");
                    return;
                }

                makeExecutableRecursive(root);
                call.resolve();
            } catch (Exception ex) {
                call.reject(ex.getMessage(), ex);
            }
        });
    }

    @PluginMethod
    public void inspectRuntime(PluginCall call) {
        execute(() -> {
            try {
                String relativePath = call.getString("relativePath");
                if (relativePath == null || relativePath.trim().isEmpty()) {
                    call.reject("relativePath is required");
                    return;
                }

                File root = resolveAppRelativePath(relativePath);
                if (!root.exists() || !root.isDirectory()) {
                    call.reject("Runtime path is missing");
                    return;
                }

                RuntimeInspection inspection = inspectRuntimeRoot(root);
                JSObject result = new JSObject();
                result.put("type", inspection.type);
                result.put("version", inspection.version);
                result.put("executablePath", inspection.executableRelativePath);
                result.put("displayName", inspection.displayName);
                call.resolve(result);
            } catch (Exception ex) {
                call.reject(ex.getMessage(), ex);
            }
        });
    }

    @PluginMethod
    public void testRuntime(PluginCall call) {
        execute(() -> {
            try {
                String executablePath = call.getString("executablePath");
                JSArray argsArray = call.getArray("args", new JSArray());
                if (executablePath == null || executablePath.trim().isEmpty()) {
                    call.reject("executablePath is required");
                    return;
                }

                File executable = resolveAppRelativePath(executablePath);
                List<String> command = new ArrayList<>();
                command.add(executable.getAbsolutePath());
                command.addAll(toStringList(argsArray));

                ProcessResult processResult = runProcess(command, executable.getParentFile(), null, null, 8000L);
                JSObject result = new JSObject();
                result.put("ok", processResult.exitCode == 0);
                result.put("stdout", processResult.stdout);
                result.put("stderr", processResult.stderr);
                result.put("exitCode", processResult.exitCode);
                call.resolve(result);
            } catch (Exception ex) {
                call.reject(ex.getMessage(), ex);
            }
        });
    }

    @PluginMethod
    public void installBundledRuntime(PluginCall call) {
        execute(() -> {
            try {
                String assetPath = call.getString("assetPath");
                String runtimeId = call.getString("runtimeId");
                if (assetPath == null || assetPath.trim().isEmpty()) {
                    call.reject("assetPath is required");
                    return;
                }
                if (runtimeId == null || runtimeId.trim().isEmpty()) {
                    call.reject("runtimeId is required");
                    return;
                }
                if (runtimeId.contains("/") || runtimeId.contains("\\") || runtimeId.contains("..")) {
                    call.reject("runtimeId is invalid");
                    return;
                }

                String normalizedAssetPath = assetPath.startsWith("/")
                    ? assetPath.substring(1)
                    : assetPath;
                File runtimesRoot = resolveAppRelativePath("skill-host/runtimes");
                if (!runtimesRoot.exists() && !runtimesRoot.mkdirs()) {
                    call.reject("Failed to create runtimes directory");
                    return;
                }

                File runtimeRoot = new File(runtimesRoot, runtimeId).getCanonicalFile();
                String runtimesRootPath = runtimesRoot.getCanonicalPath();
                if (!runtimeRoot.getAbsolutePath().startsWith(runtimesRootPath + File.separator)) {
                    call.reject("runtimeId escapes runtimes directory");
                    return;
                }

                deleteRecursively(runtimeRoot);
                if (!runtimeRoot.mkdirs()) {
                    call.reject("Failed to create runtime directory");
                    return;
                }

                unzipAssetToDirectory(normalizedAssetPath, runtimeId, runtimeRoot);
                makeExecutableRecursive(runtimeRoot);

                JSObject result = new JSObject();
                result.put("relativePath", "skill-host/runtimes/" + runtimeId);
                call.resolve(result);
            } catch (Exception ex) {
                call.reject(ex.getMessage(), ex);
            }
        });
    }

    @PluginMethod
    public void executeProcess(PluginCall call) {
        execute(() -> {
            try {
                String relativeSkillRoot = call.getString("relativeSkillRoot");
                String relativeWorkingDirectory = call.getString("relativeWorkingDirectory");
                String scriptPath = call.getString("scriptPath");
                Long timeoutMs = call.getLong("timeoutMs", 30000L);
                String stdin = call.getString("stdin");
                String pythonExecutablePath = call.getString("pythonExecutablePath");
                String nodeExecutablePath = call.getString("nodeExecutablePath");
                JSArray argvArray = call.getArray("argv", new JSArray());
                JSObject envObject = call.getObject("env", new JSObject());

                if (relativeSkillRoot == null || scriptPath == null) {
                    call.reject("relativeSkillRoot and scriptPath are required");
                    return;
                }

                File skillRoot = resolveAppRelativePath(relativeSkillRoot);
                File workingDirectory = skillRoot;
                if (relativeWorkingDirectory != null && !relativeWorkingDirectory.trim().isEmpty()) {
                    workingDirectory = resolveAppRelativePath(relativeWorkingDirectory);
                    if (!workingDirectory.exists() && !workingDirectory.mkdirs()) {
                        call.reject("Failed to create working directory");
                        return;
                    }
                    if (!workingDirectory.isDirectory()) {
                        call.reject("Working directory is not a directory");
                        return;
                    }
                }
                File script = resolveWithinRoot(skillRoot, scriptPath);
                List<String> argv = toStringList(argvArray);
                if (pythonExecutablePath != null && !pythonExecutablePath.trim().isEmpty()) {
                    envObject.put(
                        "SKILL_PYTHON_EXECUTABLE",
                        resolveAppRelativePath(pythonExecutablePath).getAbsolutePath()
                    );
                }
                if (nodeExecutablePath != null && !nodeExecutablePath.trim().isEmpty()) {
                    envObject.put(
                        "SKILL_NODE_EXECUTABLE",
                        resolveAppRelativePath(nodeExecutablePath).getAbsolutePath()
                    );
                }
                RuntimeResolution resolution = resolveCommand(
                    script,
                    argv,
                    pythonExecutablePath,
                    nodeExecutablePath
                );

                ProcessResult processResult = runProcess(
                    resolution.command,
                    workingDirectory,
                    envObject,
                    stdin,
                    timeoutMs
                );

                JSObject result = new JSObject();
                result.put("ok", processResult.exitCode == 0);
                result.put("stdout", processResult.stdout);
                result.put("stderr", processResult.stderr);
                result.put("exitCode", processResult.exitCode);
                result.put("elapsedMs", processResult.elapsedMs);
                result.put("resolvedCommand", JSArray.from(processResult.command.toArray(new String[0])));
                result.put("inferredRuntime", resolution.runtimeType);
                call.resolve(result);
            } catch (Exception ex) {
                call.reject(ex.getMessage(), ex);
            }
        });
    }

    @PluginMethod
    public void getLastKnownLocation(PluginCall call) {
        execute(() -> {
            try {
                boolean hasFinePermission =
                    ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) ==
                    PackageManager.PERMISSION_GRANTED;
                boolean hasCoarsePermission =
                    ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_COARSE_LOCATION) ==
                    PackageManager.PERMISSION_GRANTED;

                if (!hasFinePermission && !hasCoarsePermission) {
                    JSObject denied = new JSObject();
                    denied.put("available", false);
                    denied.put("reason", "location-permission-denied");
                    call.resolve(denied);
                    return;
                }

                LocationManager locationManager = (LocationManager) getContext().getSystemService(LocationManager.class);
                if (locationManager == null) {
                    JSObject unavailable = new JSObject();
                    unavailable.put("available", false);
                    unavailable.put("reason", "location-manager-unavailable");
                    call.resolve(unavailable);
                    return;
                }

                Location newest = null;
                String newestProvider = null;
                List<String> providers = locationManager.getProviders(true);
                for (String provider : providers) {
                    Location candidate = locationManager.getLastKnownLocation(provider);
                    if (candidate == null) {
                        continue;
                    }
                    if (newest == null || candidate.getTime() > newest.getTime()) {
                        newest = candidate;
                        newestProvider = provider;
                    }
                }

                if (newest == null) {
                    JSObject missing = new JSObject();
                    missing.put("available", false);
                    missing.put("reason", "last-known-location-missing");
                    call.resolve(missing);
                    return;
                }

                JSObject result = new JSObject();
                result.put("available", true);
                result.put("provider", newestProvider);
                result.put("latitude", newest.getLatitude());
                result.put("longitude", newest.getLongitude());
                result.put("accuracyMeters", newest.hasAccuracy() ? newest.getAccuracy() : JSONObject.NULL);
                result.put("altitude", newest.hasAltitude() ? newest.getAltitude() : JSONObject.NULL);
                result.put("speed", newest.hasSpeed() ? newest.getSpeed() : JSONObject.NULL);
                result.put("bearing", newest.hasBearing() ? newest.getBearing() : JSONObject.NULL);
                result.put("timestamp", newest.getTime());
                call.resolve(result);
            } catch (SecurityException ex) {
                call.reject(ex.getMessage(), ex);
            } catch (Exception ex) {
                call.reject(ex.getMessage(), ex);
            }
        });
    }

    private File resolveAppRelativePath(String relativePath) throws IOException {
        File filesDir = getContext().getFilesDir().getCanonicalFile();
        File target = new File(filesDir, relativePath).getCanonicalFile();
        if (!target.getAbsolutePath().startsWith(filesDir.getAbsolutePath())) {
            throw new IOException("Path escapes app files directory");
        }
        return target;
    }

    private File resolveWithinRoot(File root, String relativePath) throws IOException {
        File target = new File(root, relativePath).getCanonicalFile();
        if (!target.getAbsolutePath().startsWith(root.getCanonicalPath())) {
            throw new IOException("Script path escapes skill root");
        }
        if (!target.exists()) {
            throw new IOException("Script file does not exist");
        }
        return target;
    }

    private void makeExecutableRecursive(File file) {
        if (!file.exists()) {
            return;
        }
        if (file.isDirectory()) {
            file.setReadable(true, false);
            file.setWritable(true, true);
            file.setExecutable(true, false);
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) {
                    makeExecutableRecursive(child);
                }
            }
            return;
        }
        file.setReadable(true, false);
        file.setWritable(true, true);
        file.setExecutable(true, false);
    }

    private void deleteRecursively(File file) throws IOException {
        if (file == null || !file.exists()) {
            return;
        }
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteRecursively(child);
                }
            }
        }
        if (!file.delete()) {
            throw new IOException("Failed to delete " + file.getAbsolutePath());
        }
    }

    private void unzipAssetToDirectory(String assetPath, String runtimeId, File destinationRoot) throws IOException {
        String expectedPrefix = runtimeId + "/";
        byte[] buffer = new byte[8192];
        try (
            InputStream assetStream = getContext().getAssets().open(assetPath);
            ZipInputStream zipInputStream = new ZipInputStream(new BufferedInputStream(assetStream))
        ) {
            ZipEntry entry;
            while ((entry = zipInputStream.getNextEntry()) != null) {
                String entryName = entry.getName().replace('\\', '/');
                if (!entryName.startsWith(expectedPrefix)) {
                    zipInputStream.closeEntry();
                    continue;
                }
                String relativePath = entryName.substring(expectedPrefix.length());
                if (relativePath.isEmpty()) {
                    zipInputStream.closeEntry();
                    continue;
                }

                File target = new File(destinationRoot, relativePath).getCanonicalFile();
                String destinationPath = destinationRoot.getCanonicalPath();
                if (!target.getAbsolutePath().startsWith(destinationPath + File.separator)) {
                    zipInputStream.closeEntry();
                    throw new IOException("Archive entry escapes runtime root: " + entryName);
                }

                if (entry.isDirectory()) {
                    if (!target.exists() && !target.mkdirs()) {
                        zipInputStream.closeEntry();
                        throw new IOException("Failed to create directory: " + target.getAbsolutePath());
                    }
                    zipInputStream.closeEntry();
                    continue;
                }

                File parent = target.getParentFile();
                if (parent != null && !parent.exists() && !parent.mkdirs()) {
                    zipInputStream.closeEntry();
                    throw new IOException("Failed to create directory: " + parent.getAbsolutePath());
                }

                try (FileOutputStream outputStream = new FileOutputStream(target)) {
                    int read;
                    while ((read = zipInputStream.read(buffer)) != -1) {
                        outputStream.write(buffer, 0, read);
                    }
                }
                zipInputStream.closeEntry();
            }
        }
    }

    private RuntimeInspection inspectRuntimeRoot(File root) throws Exception {
        RuntimeManifest manifest = readRuntimeManifest(root);
        File executable =
            manifest != null && manifest.entrypoint != null && !manifest.entrypoint.isEmpty()
                ? resolveWithinRoot(root, manifest.entrypoint)
                : findExecutable(root);
        if (executable == null) {
            throw new IOException("No runtime executable found");
        }
        executable.setExecutable(true, false);

        String type =
            manifest != null && manifest.type != null && !manifest.type.isEmpty()
                ? manifest.type
                : executable.getName().contains("python") ? "python" : executable.getName().contains("node") ? "node" : "unknown";
        List<String> versionCommand = new ArrayList<>();
        versionCommand.add(executable.getAbsolutePath());
        versionCommand.add("--version");
        ProcessResult processResult = runProcess(
            versionCommand,
            executable.getParentFile(),
            null,
            null,
            8000L
        );
        String version =
            manifest != null && manifest.version != null && !manifest.version.isEmpty()
                ? manifest.version
                : firstNonEmpty(processResult.stdout, processResult.stderr, root.getName());
        return new RuntimeInspection(
            type,
            version.trim(),
            relativizeToFilesDir(executable),
            manifest != null && manifest.displayName != null && !manifest.displayName.isEmpty()
                ? manifest.displayName
                : root.getName()
        );
    }

    private RuntimeManifest readRuntimeManifest(File root) {
        File manifestFile = new File(root, "runtime.json");
        if (!manifestFile.exists() || !manifestFile.isFile()) {
            return null;
        }
        try {
            String raw = new String(java.nio.file.Files.readAllBytes(manifestFile.toPath()), StandardCharsets.UTF_8);
            JSONObject json = new JSONObject(raw);
            return new RuntimeManifest(
                json.optString("type", ""),
                json.optString("version", ""),
                json.optString("displayName", ""),
                json.optString("entrypoint", "")
            );
        } catch (Exception ignored) {
            return null;
        }
    }

    private File findExecutable(File root) {
        Deque<File> queue = new ArrayDeque<>();
        queue.add(root);

        while (!queue.isEmpty()) {
            File current = queue.removeFirst();
            File[] children = current.listFiles();
            if (children == null) {
                continue;
            }
            for (File child : children) {
                if (child.isDirectory()) {
                    queue.addLast(child);
                    continue;
                }
                String name = child.getName().toLowerCase();
                if (
                    name.equals("python") ||
                    name.equals("python3") ||
                    name.equals("python3.11") ||
                    name.equals("python3.12") ||
                    name.equals("node") ||
                    name.equals("nodejs")
                ) {
                    return child;
                }
            }
        }

        return null;
    }

    private String relativizeToFilesDir(File file) throws IOException {
        File filesDir = getContext().getFilesDir().getCanonicalFile();
        String prefix = filesDir.getAbsolutePath();
        String absolutePath = file.getCanonicalPath();
        if (!absolutePath.startsWith(prefix)) {
            throw new IOException("File is outside app files directory");
        }
        String relative = absolutePath.substring(prefix.length());
        if (relative.startsWith(File.separator)) {
            relative = relative.substring(1);
        }
        return relative.replace(File.separatorChar, '/');
    }

    private RuntimeResolution resolveCommand(
        File script,
        List<String> argv,
        String pythonExecutablePath,
        String nodeExecutablePath
    ) throws Exception {
        String lowerName = script.getName().toLowerCase();
        String shebang = readShebang(script);
        List<String> command = new ArrayList<>();
        String runtimeType = "native";

        if (shebang.contains("python") || lowerName.endsWith(".py")) {
            if (pythonExecutablePath == null || pythonExecutablePath.trim().isEmpty()) {
                throw new IOException("Python runtime is not installed");
            }
            File pythonExecutable = resolveAppRelativePath(pythonExecutablePath);
            pythonExecutable.setExecutable(true, false);
            command.add(pythonExecutable.getAbsolutePath());
            command.add(script.getAbsolutePath());
            runtimeType = "python";
        } else if (
            shebang.contains("node") ||
            lowerName.endsWith(".js") ||
            lowerName.endsWith(".mjs") ||
            lowerName.endsWith(".cjs")
        ) {
            if (nodeExecutablePath == null || nodeExecutablePath.trim().isEmpty()) {
                throw new IOException("Node runtime is not installed");
            }
            File nodeExecutable = resolveAppRelativePath(nodeExecutablePath);
            nodeExecutable.setExecutable(true, false);
            command.add(nodeExecutable.getAbsolutePath());
            command.add(script.getAbsolutePath());
            runtimeType = "node";
        } else if (shebang.contains("sh") || lowerName.endsWith(".sh")) {
            command.add("/system/bin/sh");
            command.add(script.getAbsolutePath());
            runtimeType = "shell";
        } else {
            script.setExecutable(true, false);
            command.add(script.getAbsolutePath());
        }

        command.addAll(argv);
        return new RuntimeResolution(runtimeType, command);
    }

    private ProcessResult runProcess(
        List<String> command,
        File workingDirectory,
        JSObject envObject,
        String stdin,
        long timeoutMs
    ) throws Exception {
        long startedAt = System.currentTimeMillis();
        List<String> launchCommand = new ArrayList<>(command);
        ProcessBuilder builder = new ProcessBuilder(launchCommand);
        if (workingDirectory != null) {
            builder.directory(workingDirectory);
        }

        Map<String, String> environment = builder.environment();
        if (envObject != null) {
            Iterator<String> keys = envObject.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                Object value = envObject.get(key);
                if (value != null) {
                    environment.put(key, String.valueOf(value));
                }
            }
        }

        File managedRuntime = resolveManagedRuntime(command, environment);
        if (managedRuntime != null) {
            applyManagedRuntimeEnvironment(environment, managedRuntime);
            launchCommand = resolveManagedRuntimeLaunchCommand(launchCommand, managedRuntime);
            builder.command(launchCommand);
        }

        Process process = builder.start();
        Future<String> stdoutFuture = ioExecutor.submit(() -> readStream(process.getInputStream()));
        Future<String> stderrFuture = ioExecutor.submit(() -> readStream(process.getErrorStream()));

        if (stdin != null) {
            try (OutputStreamWriter writer = new OutputStreamWriter(process.getOutputStream(), StandardCharsets.UTF_8)) {
                writer.write(stdin);
                writer.flush();
            }
        } else {
            process.getOutputStream().close();
        }

        boolean finished = process.waitFor(timeoutMs, TimeUnit.MILLISECONDS);
        if (!finished) {
            process.destroyForcibly();
            throw new IOException("Process timed out");
        }

        String stdout = stdoutFuture.get(1, TimeUnit.SECONDS);
        String stderr = stderrFuture.get(1, TimeUnit.SECONDS);
        return new ProcessResult(
            launchCommand,
            process.exitValue(),
            stdout,
            stderr,
            System.currentTimeMillis() - startedAt
        );
    }

    private String readShebang(File file) {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(java.nio.file.Files.newInputStream(file.toPath()), StandardCharsets.UTF_8))) {
            String line = reader.readLine();
            if (line != null && line.startsWith("#!")) {
                return line.substring(2).toLowerCase();
            }
        } catch (Exception ignored) {}
        return "";
    }

    private File resolveManagedRuntime(List<String> command, Map<String, String> environment) {
        if (command.isEmpty()) {
            return null;
        }

        File executable = new File(command.get(0));
        if (isManagedRuntimeExecutable(executable)) {
            return executable;
        }

        String nodeExecutable = environment.get("SKILL_NODE_EXECUTABLE");
        if (nodeExecutable != null && !nodeExecutable.trim().isEmpty()) {
            return new File(nodeExecutable);
        }

        String pythonExecutable = environment.get("SKILL_PYTHON_EXECUTABLE");
        if (pythonExecutable != null && !pythonExecutable.trim().isEmpty()) {
            return new File(pythonExecutable);
        }

        return null;
    }

    private boolean isManagedRuntimeExecutable(File executable) {
        String lowerName = executable.getName().toLowerCase();
        return lowerName.equals("node") || lowerName.equals("nodejs") || lowerName.startsWith("python");
    }

    private void applyManagedRuntimeEnvironment(Map<String, String> environment, File executable) {
        File binaryDir = executable.getParentFile();
        if (binaryDir == null) {
            return;
        }

        environment.put("PATH", binaryDir.getAbsolutePath() + ":" + environment.getOrDefault("PATH", ""));

        File runtimeRoot = binaryDir.getParentFile();
        if (runtimeRoot == null) {
            return;
        }

        File runtimeVarDir = new File(runtimeRoot, "var");
        File runtimeHomeDir = new File(runtimeVarDir, "home");
        runtimeHomeDir.mkdirs();
        if (!environment.containsKey("HOME") || environment.get("HOME") == null || environment.get("HOME").trim().isEmpty()) {
            environment.put("HOME", runtimeHomeDir.getAbsolutePath());
        }

        File libDir = new File(runtimeRoot, "lib");
        if (libDir.exists()) {
            environment.put(
                "LD_LIBRARY_PATH",
                libDir.getAbsolutePath() + ":" + environment.getOrDefault("LD_LIBRARY_PATH", "")
            );
        }

        boolean isPythonRuntime = executable.getName().toLowerCase().contains("python");
        if (isPythonRuntime) {
            File matplotlibConfigDir = new File(runtimeVarDir, "matplotlib");
            File pipCacheDir = new File(runtimeVarDir, "pip-cache");
            matplotlibConfigDir.mkdirs();
            pipCacheDir.mkdirs();
            environment.put("PYTHONHOME", runtimeRoot.getAbsolutePath());
            if (!environment.containsKey("MPLBACKEND") || environment.get("MPLBACKEND") == null || environment.get("MPLBACKEND").trim().isEmpty()) {
                environment.put("MPLBACKEND", "Agg");
            }
            if (!environment.containsKey("MPLCONFIGDIR") || environment.get("MPLCONFIGDIR") == null || environment.get("MPLCONFIGDIR").trim().isEmpty()) {
                environment.put("MPLCONFIGDIR", matplotlibConfigDir.getAbsolutePath());
            }
            if (!environment.containsKey("PIP_CACHE_DIR") || environment.get("PIP_CACHE_DIR") == null || environment.get("PIP_CACHE_DIR").trim().isEmpty()) {
                environment.put("PIP_CACHE_DIR", pipCacheDir.getAbsolutePath());
            }
        }

        File termuxCertFile = new File(runtimeRoot, "etc/tls/cert.pem");
        if (termuxCertFile.exists()) {
            environment.put("SSL_CERT_FILE", termuxCertFile.getAbsolutePath());
            environment.put("NODE_EXTRA_CA_CERTS", termuxCertFile.getAbsolutePath());
        }

        File opensslConfFile = new File(runtimeRoot, "etc/tls/openssl.cnf");
        if (opensslConfFile.exists()) {
            environment.put("OPENSSL_CONF", opensslConfFile.getAbsolutePath());
        }

        File sslCertDir = new File(runtimeRoot, "etc/ssl/certs");
        if (sslCertDir.exists()) {
            environment.put("SSL_CERT_DIR", sslCertDir.getAbsolutePath());
        }
    }

    private List<String> resolveManagedRuntimeLaunchCommand(List<String> command, File executable) throws IOException {
        if (command.isEmpty()) {
            return command;
        }

        File runtimeExecutable = executable.getCanonicalFile();
        File commandExecutable = new File(command.get(0)).getCanonicalFile();
        if (!commandExecutable.equals(runtimeExecutable)) {
            return command;
        }

        String linkerPath = resolveSystemLinker(runtimeExecutable);
        List<String> launchCommand = new ArrayList<>();
        launchCommand.add(linkerPath);
        launchCommand.add(runtimeExecutable.getAbsolutePath());
        if (command.size() > 1) {
            launchCommand.addAll(command.subList(1, command.size()));
        }
        return launchCommand;
    }

    private String resolveSystemLinker(File executable) throws IOException {
        String linkerName = detectElfClass(executable) == 1 ? "linker" : "linker64";
        File systemLinker = new File("/system/bin/" + linkerName);
        if (systemLinker.exists()) {
            return systemLinker.getAbsolutePath();
        }

        File apexLinker = new File("/apex/com.android.runtime/bin/" + linkerName);
        if (apexLinker.exists()) {
            return apexLinker.getAbsolutePath();
        }

        throw new IOException("Android system linker is unavailable for managed runtime");
    }

    private int detectElfClass(File executable) throws IOException {
        try (InputStream input = java.nio.file.Files.newInputStream(executable.toPath())) {
            byte[] header = new byte[5];
            int read = input.read(header);
            if (
                read == header.length &&
                header[0] == 0x7f &&
                header[1] == 'E' &&
                header[2] == 'L' &&
                header[3] == 'F' &&
                (header[4] == 1 || header[4] == 2)
            ) {
                return header[4];
            }
        }

        return Build.SUPPORTED_64_BIT_ABIS.length > 0 ? 2 : 1;
    }

    private String readStream(InputStream stream) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[4096];
        int read;
        while ((read = stream.read(buffer)) != -1) {
            output.write(buffer, 0, read);
        }
        return new String(output.toByteArray(), StandardCharsets.UTF_8);
    }

    private List<String> toStringList(JSArray values) throws JSONException {
        List<String> result = new ArrayList<>();
        if (values == null) {
            return result;
        }
        for (Object value : values.toList()) {
            result.add(String.valueOf(value));
        }
        return result;
    }

    private String firstNonEmpty(String... values) {
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) {
                return value;
            }
        }
        return "";
    }

    private static class RuntimeInspection {
        final String type;
        final String version;
        final String executableRelativePath;
        final String displayName;

        RuntimeInspection(String type, String version, String executableRelativePath, String displayName) {
            this.type = type;
            this.version = version;
            this.executableRelativePath = executableRelativePath;
            this.displayName = displayName;
        }
    }

    private static class RuntimeManifest {
        final String type;
        final String version;
        final String displayName;
        final String entrypoint;

        RuntimeManifest(String type, String version, String displayName, String entrypoint) {
            this.type = type;
            this.version = version;
            this.displayName = displayName;
            this.entrypoint = entrypoint;
        }
    }

    private static class RuntimeResolution {
        final String runtimeType;
        final List<String> command;

        RuntimeResolution(String runtimeType, List<String> command) {
            this.runtimeType = runtimeType;
            this.command = command;
        }
    }

    private static class ProcessResult {
        final List<String> command;
        final int exitCode;
        final String stdout;
        final String stderr;
        final long elapsedMs;

        ProcessResult(List<String> command, int exitCode, String stdout, String stderr, long elapsedMs) {
            this.command = command;
            this.exitCode = exitCode;
            this.stdout = stdout;
            this.stderr = stderr;
            this.elapsedMs = elapsedMs;
        }
    }
}
