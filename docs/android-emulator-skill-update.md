## chatroomai-android-emulator-test skill update notes

These are the validated machine-specific commands that should replace the outdated examples in `C:\Users\Dandwan\.codex\skills\chatroomai-android-emulator-test\SKILL.md`.

### Use the skill-local scripts

The helper scripts live under the skill directory:

```powershell
& "$env:USERPROFILE\.codex\skills\chatroomai-android-emulator-test\scripts\launch-emulator.ps1" -Mode visible -Restart
& "$env:USERPROFILE\.codex\skills\chatroomai-android-emulator-test\scripts\launch-emulator.ps1" -Mode headless -Restart
& "$env:USERPROFILE\.codex\skills\chatroomai-android-emulator-test\scripts\prepare-chatroomai.ps1" -ProjectRoot C:\Users\Dandwan\projects\ChatroomAI
```

Do not point these commands at the ChatroomAI repo `scripts/` directory. The repo only contains:

- `scripts/cap-sync-android.mjs`
- `scripts/run-android-gradle.mjs`

### Build the current app on this machine

`vite build` may fail here with `spawn EPERM` while loading the config. This works:

```powershell
npx tsc -b
npx vite build --configLoader native
node scripts/cap-sync-android.mjs
$env:GRADLE_USER_HOME='C:\Users\Dandwan\projects\ChatroomAI\.gradle-local-v120'
node scripts/run-android-gradle.mjs assembleDebug
```

### Emulator notes

- Scoop SDK root: `C:\Users\Dandwan\scoop\apps\android-clt\current`
- Visible launch uses the skill-local `launch-emulator.ps1`
- `-gpu angle_indirect` currently falls back to `auto`, but historical logs show the visible launch path can still boot successfully on this machine
- A repo-local `GRADLE_USER_HOME` is needed to avoid lock/access errors under `C:\Users\Dandwan\.gradle`
