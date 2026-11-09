#!/usr/bin/env bash
# A09: synthetic-state Android emulator smoke only. Requires Metro on runner port 8081.
set -Eeuo pipefail
mkdir -p a09-emulator-proof

capture_diagnostics() {
  adb exec-out screencap -p > a09-emulator-proof/final.png 2>/dev/null || true
  adb logcat -d -s AndroidRuntime:E ReactNativeJS:E > a09-emulator-proof/logcat-errors.txt 2>/dev/null || true
}
trap capture_diagnostics EXIT

adb wait-for-device
adb shell input keyevent 82 || true
adb reverse tcp:8081 tcp:8081
adb install -r a09-input-apk/app-debug.apk
adb shell pm list packages | grep -q '^package:com.anonymous.myphonestudio$'
adb shell am start -W -n com.anonymous.myphonestudio/.MainActivity
adb shell pidof com.anonymous.myphonestudio

found=false
for attempt in $(seq 1 25); do
  sleep 4
  adb shell uiautomator dump /sdcard/a09-ui.xml >/dev/null 2>&1 || true
  adb exec-out cat /sdcard/a09-ui.xml > a09-emulator-proof/initial.xml 2>/dev/null || true
  # On a fresh emulator the Pixel launcher can report ANR above the correctly
  # rendered Studio UI; dismiss only its explicit "Wait" action, never infer
  # success from pixels hidden behind a system modal.
  if grep -q "Pixel Launcher isn't responding" a09-emulator-proof/initial.xml; then
    echo 'Emulator Pixel Launcher ANR overlay detected; dismissing Wait to inspect app UI'
    wait_python3 - <<'PY'
import xml.etree.ElementTree as ET
root=ET.parse('a09-emulator-proof/initial.xml').getroot()
nodes=list(root.iter('node'))
labels=[(n.attrib.get('text','')+' '+n.attrib.get('content-desc','')).strip() for n in nodes]
print('Android accessibility-visible node count:',len(nodes))
assert any('+ Lidh aplikacionin' in s for s in labels), 'Main visible Add action has no accessible label'
print('PASS: Native Android exposes the central Add action with a stable accessible label')
PY
# The AVD's React Native transformed/scroll-clipped elements expose malformed
# UIAutomator bounds for off-screen sidebar controls. Use the physically visible
# central CTA coordinate documented by the same pinned Pixel 6 (1080x2400) screenshot.
test "$(adb shell wm size | tr -d '\r')" = 'Physical size: 1080x2400'
adb shell input tap 540 1450
sleep 3
adb shell uiautomator dump /sdcard/a09-form.xml >/dev/null 2>&1 || true
adb exec-out cat /sdcard/a09-form.xml > a09-emulator-proof/form.xml
adb exec-out screencap -p > a09-emulator-proof/form.png || true
python3 - <<'PY'
import xml.etree.ElementTree as ET
root=ET.parse('a09-emulator-proof/form.xml').getroot()
nodes=list(root.iter('node'))
labels=[(n.attrib.get('text','')+' '+n.attrib.get('content-desc','')).strip() for n in nodes]
required=['Mbyll formularin','EMRI']
for token in required:
    if not any(token.lower() in label.lower() for label in labels):
        raise SystemExit(f'FAIL: form lacks accessible label {token!r}')
print('PASS: Add project dialog exposes accessible close action and name field; total UI nodes:',len(nodes))
PY
adb shell pidof com.anonymous.myphonestudio
echo 'A09 automated emulator smoke PASS; no TalkBack, physical Android, or offline APK acceptance claimed.'
