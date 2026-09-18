{
  description = "Sudoku game driven by the TypeSafe Jev decision model through OpenRouter";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { nixpkgs, ... }:
    let
      forAllSystems = nixpkgs.lib.genAttrs [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];
    in
    {
      devShells = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              # frontend/, backend/, shared/: TypeScript runtime and package manager
              nodejs_24
              pnpm
              # linters run by prek
              prek
              biome
              typos
              taplo
              nixfmt
              shellcheck
              hadolint
              gitleaks
              editorconfig-checker
              # release from the commit messages
              git-cliff
              jq
            ];
          };
        }
      );
    };
}
