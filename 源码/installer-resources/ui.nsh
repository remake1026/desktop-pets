!macro customHeader
  ; Win8 / 8.1 use system DPI; newer Windows use per-monitor DPI v2.
  ManifestDPIAware true
  ManifestDPIAwareness PerMonitorV2,PerMonitor
  SetFont /LANG=2052 "Microsoft YaHei UI" 9
  !undef UNINSTALL_FILENAME
  !define UNINSTALL_FILENAME "卸载line puppy.exe"
!macroend
