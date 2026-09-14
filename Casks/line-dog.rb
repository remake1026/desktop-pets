cask "line-dog" do
  version "1.1.0"
  sha256 "65400af5229c8bd2cc85633735f6631dc92df73bb8eff47fc77db0e6e47fce01"

  url "https://github.com/remake1026/desktop-pets/releases/download/v#{version}/LineDog-#{version}-Mac-arm64.dmg",
      verified: "github.com/remake1026/desktop-pets/"
  name "线条小狗"
  desc "Desktop pet that floats on the screen"
  homepage "https://github.com/remake1026/desktop-pets"

  livecheck do
    url :homepage
    strategy :github_latest
  end

  depends_on macos: :ventura
  depends_on arch: :arm64

  app "线条小狗.app"

  uninstall quit: "io.github.remake1026.desktop-pets"

  zap trash: [
    "~/Library/Application Support/nuphy-line-dog-desktop-pet",
    "~/Library/Preferences/io.github.remake1026.desktop-pets.plist",
    "~/Library/Saved Application State/io.github.remake1026.desktop-pets.savedState",
  ]

  caveats do
    <<~EOS
      This app is ad-hoc signed and not notarized. If macOS says it cannot be
      opened, Control-click the app and choose Open, or run:

        xattr -cr /Applications/线条小狗.app
    EOS
  end
end
