cask "line-dog" do
  version "1.2.2"
  sha256 "2a8c5b66f3b9521749c36e0648dbff6751d05c882365ce49a44f902e975445db"

  url "https://github.com/remake1026/desktop-pets/releases/download/v#{version}-mac/line.puppy-#{version}-Mac-arm64.dmg"
  name "line puppy"
  desc "Desktop pet that floats on the screen"
  homepage "https://github.com/remake1026/desktop-pets"

  livecheck do
    url :homepage
    strategy :github_latest
  end

  depends_on macos: :monterey
  depends_on arch: :arm64

  app "line puppy.app"

  uninstall quit: "io.github.remake1026.desktop-pets"

  zap trash: [
    "~/Library/Application Support/line-puppy-desktop-pet",
    "~/Library/Preferences/io.github.remake1026.desktop-pets.plist",
    "~/Library/Saved Application State/io.github.remake1026.desktop-pets.savedState",
  ]

  caveats do
    <<~EOS
      This app is ad-hoc signed and not notarized. If macOS says it cannot be
      opened, Control-click the app and choose Open, or run:

        xattr -cr "/Applications/line puppy.app"
    EOS
  end
end
