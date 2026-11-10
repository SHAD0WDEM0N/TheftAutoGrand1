#!/usr/bin/env python3
"""Create a smaller, private js-dos bundle without embedding a full disc ISO.

Run locally on the owner's computer. No files are uploaded or downloaded.
A disc-dependent game can stop working when its disc is removed.
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path
import re
import shutil
import sys
import zipfile


CONFIG = ".jsdos/dosbox.conf"


def normalize_name(name: str) -> str:
    return name.replace("\\", "/").lstrip("./").lower()


def make_autoexec(original: str, commands: list[str]) -> str:
    if not commands or not all(line.strip() for line in commands):
        raise ValueError("Provide DOS commands that actually launch the installed game.")
    if any("\n" in line or "\r" in line for line in commands):
        raise ValueError("Use semicolons between commands, not newlines.")
    match = re.search(r"(?im)^\[autoexec\][ \t]*\r?$", original)
    if match is None:
        raise ValueError("Bundle has no [autoexec] section.")
    remainder = original[match.end():]
    other_section = re.search(r"(?m)^\[[^\]\r\n]+\][ \t]*\r?$", remainder)
    trailing = remainder[other_section.start():] if other_section else ""
    base = original[:match.start()].rstrip() + "\n"
    boot = "\n".join(["[autoexec]", "@echo off", "mount c .", "c:", *commands, ""])
    return base + boot + trailing


def list_largest(path: Path) -> None:
    with zipfile.ZipFile(path, "r") as archive:
        items = sorted((i for i in archive.infolist() if not i.is_dir()),
                       key=lambda i: i.file_size, reverse=True)
        print("Largest files in your private bundle (uncompressed):")
        for item in items[:15]:
            print(f"{item.file_size / (1024 * 1024):9.1f} MiB   {item.filename}")
        print(f"Total archived file size: {sum(i.file_size for i in items) / 1048576:.1f} MiB")
        print("No changes made.")


def create_compact_bundle(source: Path, target: Path, drop: str, commands: list[str]) -> tuple[int, int]:
    if not source.is_file():
        raise ValueError(f"Input bundle not found: {source}")
    if source.resolve() == target.resolve():
        raise ValueError("Output must not overwrite the original bundle.")
    if target.exists():
        raise ValueError("Output already exists. Choose a different path; the original remains unchanged.")
    with zipfile.ZipFile(source, "r") as archive:
        entries = archive.infolist()
        found = [item.filename for item in entries if normalize_name(item.filename) == normalize_name(drop)]
        if len(found) != 1:
            raise ValueError(f'Expected exactly one "{drop}" disc image inside the bundle, found {len(found)}. '
                             'Use --list first, then --drop with the exact archive path.')
        configs = [item for item in entries if normalize_name(item.filename) == CONFIG]
        if len(configs) != 1:
            raise ValueError("No unique .jsdos/dosbox.conf found. This is not a supported js-dos backup.")
        try:
            original_conf = archive.read(configs[0]).decode("utf-8")
        except UnicodeDecodeError as ex:
            raise ValueError("The DOSBox config is not UTF-8. No output created.") from ex
        new_config = make_autoexec(original_conf, commands).encode("utf-8")
        dropped_bytes = next(i.file_size for i in entries if i.filename == found[0])
        target.parent.mkdir(parents=True, exist_ok=True)
        try:
            with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6,
                                 allowZip64=True) as output:
                for entry in entries:
                    if entry.filename == found[0]:
                        continue
                    if normalize_name(entry.filename) == CONFIG:
                        output.writestr(entry, new_config)
                    elif entry.is_dir():
                        output.writestr(entry, b"")
                    else:
                        with archive.open(entry, "r") as incoming, output.open(entry, "w",
                                                                               force_zip64=True) as outgoing:
                            shutil.copyfileobj(incoming, outgoing, length=1024 * 1024)
        except Exception:
            if target.exists():
                target.unlink()
            raise
    return dropped_bytes, target.stat().st_size


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Locally compact a personally owned .jsdos GTA backup.")
    parser.add_argument("source", type=Path, help="Input .jsdos backup exported from the desktop website")
    parser.add_argument("--list", action="store_true", help="Show large archive entries without changing anything")
    parser.add_argument("--output", type=Path, help="New .jsdos file; never replaces the original")
    parser.add_argument("--drop", default="disc.iso",
                        help='Exact ZIP member to exclude (default: "disc.iso")')
    parser.add_argument("--boot", help='Working DOS launch commands, separated by semicolons; e.g. "c:;cd GTA;GTA.BAT"')
    args = parser.parse_args(argv)
    try:
        if args.list:
            list_largest(args.source)
            return 0
        if not args.boot:
            parser.error('--boot is required when removing a disc image. Use the real launch commands from your game.')
        commands = [part.strip() for part in args.boot.split(";")]
        if not all(commands):
            parser.error("Empty boot command. Separate non-empty DOS commands with semicolons.")
        output = args.output or args.source.with_name(args.source.stem + "-mobile.jsdos")
        removed, size = create_compact_bundle(args.source, output, args.drop, commands)
        print(f"Saved PRIVATE mobile candidate: {output}")
        print(f"Removed CD image: {removed / 1048576:.1f} MiB uncompressed")
        print(f"New bundle size: {size / 1048576:.1f} MiB")
        print("Keep the original backup. Test this file on desktop first. Some GTA editions need the CD image;")
        print("if it cannot start or misses data, restore the original and use a different image strategy.")
        print("Do NOT upload either bundle to a public GitHub repository.")
        return 0
    except (OSError, ValueError, zipfile.BadZipFile, RuntimeError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
