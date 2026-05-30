on run argv
  set appUrl to item 1 of argv
  set outDir to item 2 of argv

  tell application "Safari"
    activate
    if (count of windows) = 0 then
      make new document
    end if
    set bounds of front window to {80, 60, 1520, 1200}
    set URL of front document to appUrl
  end tell

  delay 2

  tell application "Safari"
    do JavaScript "window.scrollTo(0, document.body.scrollHeight);" in front document
  end tell

  delay 1

  tell application "Safari"
    set timelineInfo to do JavaScript "
      (() => {
        const header = Array.from(document.querySelectorAll('*')).find(
          (node) => node.textContent && node.textContent.includes('Engine Replay Timeline'),
        );
        if (!header) return 'missing';
        const card = header.closest('section,div');
        if (!card) return 'missing';
        const rect = card.getBoundingClientRect();
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;
        const dpr = window.devicePixelRatio || 1;
        return [scrollX, scrollY, rect.left, rect.top, rect.width, rect.height, dpr].join(',');
      })();
    " in front document
    set windowBounds to bounds of front window
  end tell

  return timelineInfo & "|" & (item 1 of windowBounds as string) & "," & (item 2 of windowBounds as string) & "," & (item 3 of windowBounds as string) & "," & (item 4 of windowBounds as string) & "|" & outDir
end run
