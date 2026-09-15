cask "line-dog" do
  version "1.1.0"
  sha256 "65400af5229c8bd2cc85633735f6631dc92df73bb8eff47fc77db0e6e47fce01"

  url "https://github.com/remake1026/desktop-pets/releases/download/v#{version}/LineDog-#{version}-Mac-arm64.dmg",
      verified: "github.com/remake1026/desktop-pets/"
  name "line puppy"
  desc "Desktop pet that floats on the screen"
  homepage "https://github.com/remake1026/desktop-pets"

  livecheck do
    url :homepage
    strategy :github_latest
  end

  depends_on macos: :ventura
  depends_on arch: :arm64

  # The published 1.1.0 archive still has its historical bundle filename.
  # Install it under the current product name until a new Mac release is published.
  legacy_bundle = [0x7ebf, 0x6761, 0x5c0f, 0x72d7].pack("U*")
  app "#{legacy_bundle}.app", target: "line puppy.app"

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
