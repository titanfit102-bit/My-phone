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
    wait_coords=$(python3 - <<'PY'
import re,xml.etree.ElementTree as ET
r=ET.parse('a09-emulator-proof/initial.xml').getroot()
for n in r.iter('node'):
    if n.attrib.get('text')=='Wait':
        v=list(map(int,re.findall(r'\d+',n.attrib.get('bounds',''))))
        if len(v)==4:
            print((v[0]+v[2])//2,(v[1]+v[3])//2)
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

coords=$(python3 - <<'PY'
import re,xml.etree.ElementTree as ET
root=ET.parse('a09-emulator-proof/initial.xml').getroot()
nodes=list(root.iter('node'))
labels=[(n.attrib.get('text','')+' '+n.attrib.get('content-desc','')).strip() for n in nodes]
print('',file=__import__('sys').stderr)
print('Accessible Android UI nodes:',len(nodes),file=__import__('sys').stderr)
buttons=[n for n in nodes if any(k in ((n.attrib.get('text','')+' '+n.attrib.get('content-desc',''))) for k in ['+ Shto','+ Lidh aplikacionin'])]
if not buttons:
    raise SystemExit('FAIL: no accessible Add button found on native Studio UI')
box=buttons[0].attrib.get('bounds','')
nums=list(map(int,re.findall(r'\d+',box)))
if len(nums)!=4:
    raise SystemExit('FAIL: accessible Add button has invalid bounds')
print((nums[0]+nums[2])//2,(nums[1]+nums[3])//2)
PY
)
adb shell input tap $coords
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
