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
  # The emulator can display a transient Pixel Launcher ANR modal over a healthy Studio UI.
  # Select only the modal's explicit Wait button; do not bypass the app UI assertion.
  if grep -q "Pixel Launcher isn't responding" a09-emulator-proof/initial.xml; then
    echo 'Pixel Launcher ANR overlay detected, selecting Wait before checking native UI'
    wait_coords=$(python3 - <<'PY'
import re
import xml.etree.ElementTree as ET
root=ET.parse('a09-emulator-proof/initial.xml').getroot()
for node in root.iter('node'):
    if node.attrib.get('text')=='Wait':
        values=list(map(int,re.findall(r'\d+',node.attrib.get('bounds',''))))
        if len(values)==4:
            print((values[0]+values[2])//2,(values[1]+values[3])//2)
        break
PY
)
    if [ -n "$wait_coords" ]; then
      adb shell input tap $wait_coords
      sleep 2
      continue
    fi
  fi
  if grep -Eq 'MY PHONE|EXPO STUDIO|Studio është gati|Lidh aplikacionin' a09-emulator-proof/initial.xml; then
    found=true
    break
  fi
done

if [ "$found" != true ]; then
  echo 'FAIL: Native Studio interface did not render an expected label after installing the exact debug APK.'
  tail -90 "$RUNNER_TEMP/a09-metro.log" || true
  exit 1
fi

echo 'PASS: Android app process and Studio native UI are visible.'
adb exec-out screencap -p > a09-emulator-proof/initial.png || true

# The pinned Pixel 6 screenshot shows the central accessible action near (540,1450).
# UIAutomator's offscreen React Native sidebar bounds can report y2<y1, so do not
# click the first sidebar action by its invalid bounds.
python3 - <<'PY'
import xml.etree.ElementTree as ET
root=ET.parse('a09-emulator-proof/initial.xml').getroot()
nodes=list(root.iter('node'))
labels=[(n.attrib.get('text','')+' '+n.attrib.get('content-desc','')).strip() for n in nodes]
print('Visible Android accessibility hierarchy nodes:',len(nodes))
assert any('+ Lidh aplikacionin' in label for label in labels), 'Central Add action lacks accessible label'
print('PASS: Native Android exposes the central Add action label')
PY
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
