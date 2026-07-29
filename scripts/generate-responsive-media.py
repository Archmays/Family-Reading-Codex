#!/usr/bin/env python3
"""Generate deterministic, manifest-owned responsive image derivatives for FR-P5."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import shutil
import sys
import tempfile
from typing import Any, Iterable
import unicodedata

try:
    from PIL import Image, ImageOps, features, __version__ as PILLOW_VERSION
except ImportError as exc:  # pragma: no cover - local environment gate
    raise SystemExit("Pillow is required for FR-P5 media generation.") from exc


ROOT = Path(__file__).resolve().parents[1]
INVENTORY_PATH = ROOT / "reports/portfolio/fr-p5/fr-p5-media-reference-inventory.json"
POLICY_PATH = ROOT / "operations/maintenance/fr-maint-media-slim-01/media-quality-policy.json"
MANIFEST_PATH = ROOT / "public/media/media-manifest.json"
DERIVED_ROOT = ROOT / "public/media/derived"
SCRATCH_ROOT = ROOT / "task-scratch/fr-p5"
DERIVATIVE_POLICY_HASH_HEX_LENGTH = 32
WORK_CELLS_THUMBNAIL_ROOT = "public/assets/cells-at-work/page-thumbnails/"
WORK_CELLS_HIGH_RESOLUTION_ROOT = "public/assets/cells-at-work/pages-by-volume/"
GENERATOR_VERSION = "fr-p5-media-3"
PYTHON_VERSION = platform.python_version()
LIBWEBP_VERSION = str(features.version("webp") or "")
ALLOWED_OUTPUT_PREFIXES = (
    ROOT / "public/media",
    ROOT / "reports/portfolio/fr-p5",
    SCRATCH_ROOT,
)
IMAGE_EXTENSIONS = {".avif", ".gif", ".jpeg", ".jpg", ".png", ".webp"}
OUTPUT_FORMATS = {"avif", "jpeg", "png", "webp"}
ENCODER_OPTION_KEYS = {
    "compressLevel",
    "exact",
    "lossless",
    "method",
    "optimize",
    "progressive",
    "quality",
    "speed",
    "subsampling",
}
MEDIA_ROLES = {
    "carmela-series-cover",
    "carmela-book-cover",
    "carmela-page-preview",
    "carmela-explanation-preview",
    "carmela-lightbox",
    "work-cells-series-thumbnail",
    "work-cells-topic-hero",
    "work-cells-station-preview",
    "work-cells-manga-preview",
    "work-cells-lightbox",
}
PROFILE_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_-]*$")
HASH_PATTERN = re.compile(r"^[a-f0-9]{64}$")
HEX_COLOR_PATTERN = re.compile(r"^#[a-fA-F0-9]{6}$")
WINDOWS_RESERVED_NAME = re.compile(
    r"^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)",
    re.IGNORECASE,
)
UNSAFE_PATH_CHARACTER = re.compile(r'[\x00-\x1f\x7f<>"|?*#]')


def canonical_json(value: Any) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=False) + "\n"
    ).encode("utf-8")


def canonical_hash(value: Any) -> str:
    compact = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")
    return hashlib.sha256(compact).hexdigest()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def repository_path(path: Path) -> str:
    resolved = path.resolve()
    try:
        return resolved.relative_to(ROOT.resolve()).as_posix()
    except ValueError as exc:
        raise ValueError(f"Path is outside the repository: {path}") from exc


def normalize_repository_path(value: Any, *, require_public: bool = True) -> str:
    raw = str(value or "").strip().replace("\\", "/")
    if (
        not raw
        or raw.startswith("/")
        or re.match(r"^[A-Za-z]:/", raw)
        or "//" in raw
    ):
        raise ValueError(f"Unsafe repository path: {value!r}")
    parts = raw.split("/")
    if any(
        not part
        or part in {".", ".."}
        or part.endswith((".", " "))
        or ":" in part
        or UNSAFE_PATH_CHARACTER.search(part)
        or WINDOWS_RESERVED_NAME.search(part)
        for part in parts
    ):
        raise ValueError(f"Unsafe repository path segments: {value!r}")
    if require_public and parts[0] != "public":
        raise ValueError(f"Media input must stay under public/: {raw}")
    return "/".join(parts)


def resolve_repository_path(value: str) -> Path:
    normalized = normalize_repository_path(value)
    if Path(normalized).suffix.lower() not in IMAGE_EXTENSIONS:
        raise ValueError(f"Unsupported source image extension: {normalized}")
    target = (ROOT / Path(*normalized.split("/"))).resolve(strict=True)
    repository_path(target)
    if not target.is_file():
        raise ValueError(f"Media source is not a regular file: {normalized}")
    return target


def assert_allowed_output(path: Path) -> Path:
    resolved = path.resolve()
    repository_path(resolved)
    for prefix in ALLOWED_OUTPUT_PREFIXES:
        prefix_resolved = prefix.resolve()
        if resolved == prefix_resolved or prefix_resolved in resolved.parents:
            return resolved
    raise ValueError(f"FR-P5 output path is outside the allowlist: {path}")


def assert_scratch_preview_output(path: Path) -> Path:
    resolved = assert_allowed_output(path)
    scratch = SCRATCH_ROOT.resolve()
    if resolved == scratch or scratch not in resolved.parents:
        raise ValueError("--output must be a child directory of task-scratch/fr-p5/.")
    return resolved


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_hash(value: Any, label: str) -> str:
    text = str(value or "").lower()
    if not HASH_PATTERN.fullmatch(text):
        raise ValueError(f"{label} must be a SHA-256 digest.")
    return text


def normalized_format(value: Any) -> str:
    format_name = str(value or "").lower().lstrip(".")
    if format_name == "jpg":
        return "jpeg"
    if format_name not in OUTPUT_FORMATS:
        raise ValueError(f"Unsupported output format: {value}")
    return format_name


def normalized_source_format(value: Any) -> str:
    format_name = str(value or "").lower().lstrip(".")
    if format_name == "jpg":
        return "jpeg"
    if f".{format_name}" not in IMAGE_EXTENSIONS:
        raise ValueError(f"Unsupported decoded source format: {value}")
    return format_name


def safe_stem(source_path: str) -> str:
    stem = unicodedata.normalize("NFKD", Path(source_path).stem.lower())
    output = []
    previous_dash = False
    for character in stem:
        if character.isascii() and (character.isalnum() or character in "_-"):
            output.append(character)
            previous_dash = False
        elif not previous_dash:
            output.append("-")
            previous_dash = True
    return "".join(output).strip("-") or "media"


def derivative_repository_path(
    source_path: str,
    source_hash: str,
    policy_hash: str,
    profile_id: str,
    extension: str,
) -> str:
    profile = str(profile_id).strip().lower()
    if not PROFILE_PATTERN.fullmatch(profile):
        raise ValueError(f"Invalid profile id: {profile_id}")
    source_digest = validate_hash(source_hash, "Derivative source hash")
    policy_digest = validate_hash(policy_hash, "Derivative policy hash")
    output_format = normalized_format(extension)
    suffix = "jpg" if output_format == "jpeg" else output_format
    policy_path_identity = policy_digest[:DERIVATIVE_POLICY_HASH_HEX_LENGTH]
    return (
        f"public/media/derived/{policy_path_identity}/"
        f"{source_digest[:2]}/{source_digest[2:14]}/"
        f"{safe_stem(source_path)}-{profile}.{suffix}"
    )


def image_has_alpha(image: Image.Image) -> bool:
    return image.mode in {"RGBA", "LA"} or (
        image.mode == "P" and "transparency" in image.info
    )


def inspect_source_image(source_path: Path) -> tuple[Image.Image, dict[str, Any]]:
    with Image.open(source_path) as source:
        decoded_format = normalized_source_format(
            source.format or source_path.suffix.lstrip(".")
        )
        stored_width, stored_height = source.size
        frame_count = int(getattr(source, "n_frames", 1))
        animated = bool(getattr(source, "is_animated", False) or frame_count > 1)
        raw_orientation = source.getexif().get(274, 1)
        try:
            orientation = int(raw_orientation or 1)
        except (TypeError, ValueError) as exc:
            raise ValueError(
                f"Invalid EXIF orientation {raw_orientation!r}: {repository_path(source_path)}"
            ) from exc
        if orientation not in range(1, 9):
            raise ValueError(
                f"Unsupported EXIF orientation {orientation}: {repository_path(source_path)}"
            )
        image = ImageOps.exif_transpose(source)
        image.seek(0)
        image.load()
        metadata = {
            "storedWidth": stored_width,
            "storedHeight": stored_height,
            "width": image.width,
            "height": image.height,
            "decodedFormat": decoded_format,
            "mode": image.mode,
            "hasAlpha": image_has_alpha(image),
            "exifOrientation": orientation,
            "orientationNormalized": orientation != 1,
            "frameCount": frame_count,
            "animated": animated,
        }
        return image.copy(), metadata


def resize_image(image: Image.Image, width: int) -> Image.Image:
    if width <= 0:
        raise ValueError("Derivative width must be positive.")
    target_width = min(width, image.width)
    if target_width == image.width:
        return image.copy()
    target_height = max(1, round(image.height * target_width / image.width))
    return image.resize((target_width, target_height), Image.Resampling.LANCZOS)


def parse_hex_color(value: str) -> tuple[int, int, int, int]:
    if not HEX_COLOR_PATTERN.fullmatch(str(value or "")):
        raise ValueError(f"Alpha flatten color must be #RRGGBB: {value!r}")
    return (
        int(value[1:3], 16),
        int(value[3:5], 16),
        int(value[5:7], 16),
        255,
    )


def prepare_mode(
    image: Image.Image,
    output_format: str,
    preserve_alpha: bool,
    flatten_color: str,
) -> tuple[Image.Image, bool]:
    has_alpha = image_has_alpha(image)
    supports_alpha = output_format in {"avif", "png", "webp"}
    if has_alpha and preserve_alpha and supports_alpha:
        return image.convert("RGBA"), True
    if has_alpha:
        foreground = image.convert("RGBA")
        background = Image.new("RGBA", image.size, parse_hex_color(flatten_color))
        return Image.alpha_composite(background, foreground).convert("RGB"), False
    return image.convert("RGB"), False


def require_int(
    value: Any,
    label: str,
    minimum: int,
    maximum: int,
) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"{label} must be an integer.")
    if value < minimum or value > maximum:
        raise ValueError(f"{label} must be between {minimum} and {maximum}.")
    return value


def require_bool(value: Any, label: str) -> bool:
    if not isinstance(value, bool):
        raise ValueError(f"{label} must be boolean.")
    return value


def encoder_options(profile: dict[str, Any]) -> dict[str, Any]:
    profile_id = str(profile.get("id") or "<unknown>")
    output_format = normalized_format(profile.get("format"))
    label = f"Profile {profile_id}"
    allowed_keys = {
        "webp": {"exact", "lossless", "method", "quality"},
        "jpeg": {"optimize", "progressive", "quality", "subsampling"},
        "png": {"compressLevel", "optimize"},
        "avif": {"quality", "speed"},
    }[output_format]
    for key in ENCODER_OPTION_KEYS:
        if key in profile and key not in allowed_keys:
            raise ValueError(f"{label} {key} is not supported for {output_format}.")
    if output_format == "webp":
        return {
            "exact": require_bool(profile.get("exact"), f"{label} exact"),
            "lossless": require_bool(profile.get("lossless"), f"{label} lossless"),
            "method": require_int(profile.get("method"), f"{label} method", 0, 6),
            "quality": require_int(profile.get("quality"), f"{label} quality", 0, 100),
        }
    if output_format == "jpeg":
        return {
            "optimize": require_bool(profile.get("optimize"), f"{label} optimize"),
            "progressive": require_bool(
                profile.get("progressive"), f"{label} progressive"
            ),
            "quality": require_int(profile.get("quality"), f"{label} quality", 0, 100),
            "subsampling": require_int(
                profile.get("subsampling"), f"{label} subsampling", 0, 2
            ),
        }
    if output_format == "png":
        return {
            "compressLevel": require_int(
                profile.get("compressLevel"), f"{label} compressLevel", 0, 9
            ),
            "optimize": require_bool(profile.get("optimize"), f"{label} optimize"),
        }
    return {
        "quality": require_int(profile.get("quality"), f"{label} quality", 0, 100),
        "speed": require_int(profile.get("speed"), f"{label} speed", 0, 10),
    }


def save_variant(
    image: Image.Image,
    target: Path,
    profile: dict[str, Any],
    flatten_color: str,
) -> dict[str, Any]:
    output_format = normalized_format(profile["format"])
    preserve_alpha = bool(profile["preserveAlpha"])
    prepared, alpha_preserved = prepare_mode(
        image,
        output_format,
        preserve_alpha,
        flatten_color,
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(f".{target.name}.tmp")
    options = encoder_options(profile)
    if output_format == "webp":
        save_options = {"format": "WEBP", **options}
    elif output_format == "jpeg":
        save_options = {"format": "JPEG", **options}
    elif output_format == "png":
        save_options = {
            "format": "PNG",
            "compress_level": options["compressLevel"],
            "optimize": options["optimize"],
        }
    else:
        save_options = {"format": "AVIF", **options}
    try:
        prepared.save(temporary, **save_options)
    except (KeyError, OSError, TypeError, ValueError) as exc:
        temporary.unlink(missing_ok=True)
        raise ValueError(
            f"Pillow {PILLOW_VERSION} rejected {output_format} options "
            f"{json.dumps(options, sort_keys=True)} for {repository_path(target)}: {exc}"
        ) from exc
    os.replace(temporary, target)
    with Image.open(target) as verification:
        verification.load()
        actual_format = normalized_format(
            verification.format or target.suffix.lstrip(".")
        )
        if actual_format != output_format:
            raise ValueError(
                f"Encoded format mismatch for {repository_path(target)}: "
                f"{actual_format} != {output_format}"
            )
        return {
            "mode": verification.mode,
            "hasAlpha": image_has_alpha(verification),
            "alphaPreserved": alpha_preserved,
        }


def validate_policy(policy: dict[str, Any]) -> None:
    if policy.get("schemaVersion") != 1 or policy.get("status") != "accepted":
        raise ValueError("FR-P5 requires an accepted schemaVersion 1 media policy.")
    encoder = policy.get("encoder") or {}
    if encoder.get("name") != "Pillow":
        raise ValueError("The accepted FR-P5 policy must name Pillow.")
    if str(encoder.get("version")) != PILLOW_VERSION:
        raise ValueError(
            f"Pillow version mismatch: policy={encoder.get('version')} "
            f"runtime={PILLOW_VERSION}."
        )
    if str(encoder.get("pythonVersion")) != PYTHON_VERSION:
        raise ValueError(
            f"Python version mismatch: policy={encoder.get('pythonVersion')} "
            f"runtime={PYTHON_VERSION}."
        )
    if str(encoder.get("libwebpVersion")) != LIBWEBP_VERSION:
        raise ValueError(
            f"libwebp version mismatch: policy={encoder.get('libwebpVersion')} "
            f"runtime={LIBWEBP_VERSION or '<unavailable>'}."
        )

    profiles = policy.get("profiles")
    if not isinstance(profiles, list) or not profiles:
        raise ValueError("Media quality policy profiles must be non-empty.")
    ids: set[str] = set()
    covered_roles: set[str] = set()
    for profile in profiles:
        profile_id = str(profile.get("id") or "")
        if not PROFILE_PATTERN.fullmatch(profile_id) or profile_id in ids:
            raise ValueError(f"Invalid or duplicate media profile id: {profile_id}")
        ids.add(profile_id)
        roles = profile.get("roles")
        if (
            not isinstance(roles, list)
            or not roles
            or roles != sorted(roles)
            or len(set(roles)) != len(roles)
            or any(role not in MEDIA_ROLES for role in roles)
        ):
            raise ValueError(f"Profile {profile_id} has invalid or unstable roles.")
        covered_roles.update(roles)
        require_int(profile.get("width"), f"Profile {profile_id} width", 1, 100_000)
        preserve_alpha = require_bool(
            profile.get("preserveAlpha"),
            f"Profile {profile_id} preserveAlpha",
        )
        output_format = normalized_format(profile.get("format"))
        if output_format == "jpeg" and preserve_alpha:
            raise ValueError(f"Profile {profile_id} cannot preserve alpha in JPEG.")
        encoder_options(profile)
        Image.init()
        if output_format.upper() not in Image.SAVE:
            raise ValueError(
                f"Pillow {PILLOW_VERSION} has no {output_format.upper()} encoder; "
                f"profile {profile_id} cannot be accepted."
            )
        if output_format == "webp" and not features.check("webp"):
            raise ValueError(
                f"Pillow {PILLOW_VERSION} reports WebP support unavailable."
            )
    if [str(profile["id"]) for profile in profiles] != sorted(ids):
        raise ValueError("Media quality policy profiles must use stable id order.")
    missing_roles = sorted(MEDIA_ROLES - covered_roles)
    if missing_roles:
        raise ValueError(f"Media quality policy does not cover roles: {missing_roles}")

    alpha_strategy = policy.get("alphaStrategy") or {}
    if alpha_strategy.get("preserveWhenSupported") is not True:
        raise ValueError("alphaStrategy.preserveWhenSupported must be true.")
    parse_hex_color(str(alpha_strategy.get("flattenColor") or ""))

    fallback = policy.get("fallbackStrategy") or {}
    if fallback.get("preferDerivative") is not True:
        raise ValueError("fallbackStrategy.preferDerivative must be true.")
    if fallback.get("allowSourcePath") is not False:
        raise ValueError("fallbackStrategy.allowSourcePath must be false.")
    format_order = fallback.get("formatOrder")
    if not isinstance(format_order, list) or not format_order:
        raise ValueError("fallbackStrategy.formatOrder must be non-empty.")
    normalized_order = [normalized_format(value) for value in format_order]
    if len(set(normalized_order)) != len(normalized_order):
        raise ValueError("fallbackStrategy.formatOrder contains duplicates.")
    if not any(value != "avif" for value in normalized_order):
        raise ValueError("fallbackStrategy.formatOrder cannot be AVIF-only.")

    acceptance = policy.get("visualAcceptance") or {}
    if (
        acceptance.get("status") != "pass"
        or not isinstance(acceptance.get("sampleMediaIds"), list)
        or not acceptance["sampleMediaIds"]
        or len(set(acceptance["sampleMediaIds"]))
        != len(acceptance["sampleMediaIds"])
    ):
        raise ValueError("visualAcceptance must be a passing, non-empty sample set.")
    budgets = policy.get("budgets") or {}
    if budgets.get("status") != "frozen":
        raise ValueError("Policy budgets must be frozen.")
    require_int(budgets.get("distBytes"), "budgets.distBytes", 1, sys.maxsize)
    require_int(
        budgets.get("pagesArtifactBytes"),
        "budgets.pagesArtifactBytes",
        1,
        sys.maxsize,
    )
    route_budgets = budgets.get("routeTransferBytes")
    if not isinstance(route_budgets, dict) or not route_budgets:
        raise ValueError("budgets.routeTransferBytes must be non-empty.")
    for route, byte_budget in route_budgets.items():
        if not str(route).startswith("#/"):
            raise ValueError(f"Invalid route budget key: {route}")
        require_int(byte_budget, f"Route budget {route}", 1, sys.maxsize)


def selected_profiles(
    policy: dict[str, Any],
    roles: Iterable[str],
    role_filter: str | None,
) -> list[dict[str, Any]]:
    role_set = set(roles)
    selected = []
    for profile in policy["profiles"]:
        matching_roles = sorted(role_set & set(profile["roles"]))
        if role_filter and role_filter not in matching_roles:
            continue
        if not matching_roles:
            continue
        selected.append({**profile, "matchingRoles": matching_roles})
    return sorted(selected, key=lambda item: str(item["id"]))


def selected_entry_roles(
    roles: Iterable[str],
    role_filter: str | None,
) -> list[str]:
    selected = sorted(set(roles))
    if role_filter is None:
        return selected
    return [role_filter] if role_filter in selected else []


def assert_inventory_metadata(
    record: dict[str, Any],
    actual: dict[str, Any],
    source_path: str,
) -> None:
    metadata = record.get("metadata")
    if not isinstance(metadata, dict) or metadata.get("decodeStatus") != "ok":
        raise ValueError(f"Inventory lacks passing Pillow metadata: {source_path}")
    expected_fields = (
        "storedWidth",
        "storedHeight",
        "width",
        "height",
        "decodedFormat",
        "mode",
        "hasAlpha",
        "exifOrientation",
        "orientationNormalized",
        "frameCount",
        "animated",
    )
    for field in expected_fields:
        if metadata.get(field) != actual[field]:
            raise ValueError(
                f"Inventory metadata is stale for {source_path}: "
                f"{field}={metadata.get(field)!r}, actual={actual[field]!r}"
            )


def choose_role_fallbacks(
    roles: list[str],
    variants: list[dict[str, Any]],
    policy: dict[str, Any],
) -> dict[str, str]:
    format_order = [
        normalized_format(value)
        for value in policy["fallbackStrategy"]["formatOrder"]
    ]
    rank = {format_name: index for index, format_name in enumerate(format_order)}
    fallbacks: dict[str, str] = {}
    for role in roles:
        candidates = [
            variant
            for variant in variants
            if role in variant["roles"]
            and variant["format"] != "avif"
            and variant["format"] in rank
        ]
        if not candidates:
            raise ValueError(
                f"No accepted non-AVIF derivative fallback exists for role {role}."
            )
        candidates.sort(
            key=lambda item: (
                rank[item["format"]],
                -int(item["width"]),
                str(item["profileId"]),
                str(item["path"]),
            )
        )
        fallbacks[role] = candidates[0]["path"]
    return fallbacks


def create_entry(
    record: dict[str, Any],
    policy: dict[str, Any],
    policy_hash: str,
    output_root: Path,
    sample_filter: str | None,
    role_filter: str | None,
    write_files: bool,
) -> dict[str, Any] | None:
    source_path = normalize_repository_path(record["path"])
    media_id = str(record.get("mediaId") or source_path)
    if sample_filter and sample_filter not in {media_id, source_path}:
        return None
    roles = selected_entry_roles(record.get("roles") or [], role_filter)
    profiles = selected_profiles(policy, roles, role_filter)
    if not profiles:
        return None
    if record.get("present") is not True:
        raise ValueError(f"Referenced media is not present: {source_path}")
    reference_file = resolve_repository_path(source_path)
    reference_bytes = reference_file.read_bytes()
    reference_hash = sha256_bytes(reference_bytes)
    if reference_hash != validate_hash(record.get("sha256"), f"Inventory hash for {source_path}"):
        raise ValueError(f"Inventory logical reference hash is stale: {source_path}")
    if len(reference_bytes) != record.get("bytes"):
        raise ValueError(f"Inventory logical reference byte count is stale: {source_path}")
    _, reference_metadata = inspect_source_image(reference_file)
    assert_inventory_metadata(record, reference_metadata, source_path)

    derivation_record = record.get("derivationSource")
    if not isinstance(derivation_record, dict):
        raise ValueError(f"Inventory derivation lineage is missing: {source_path}")
    derivation_path = normalize_repository_path(derivation_record.get("path"))
    lineage_kind = str(derivation_record.get("kind") or "")
    if lineage_kind not in {"self", "work-cells-high-resolution-counterpart"}:
        raise ValueError(f"Unsupported derivation lineage kind for {source_path}: {lineage_kind}")
    if lineage_kind == "self" and derivation_path != source_path:
        raise ValueError(f"Self derivation lineage must use the logical source path: {source_path}")
    if lineage_kind == "work-cells-high-resolution-counterpart":
        if not source_path.startswith(WORK_CELLS_THUMBNAIL_ROOT):
            raise ValueError(f"High-resolution lineage requires a Work Cells thumbnail: {source_path}")
        expected_derivation_path = (
            WORK_CELLS_HIGH_RESOLUTION_ROOT
            + source_path[len(WORK_CELLS_THUMBNAIL_ROOT):]
        )
        if derivation_path != expected_derivation_path:
            raise ValueError(
                f"High-resolution lineage must use exact same-name counterpart: "
                f"{expected_derivation_path}"
            )
        if any(not role.startswith("work-cells-") for role in roles):
            raise ValueError(f"High-resolution lineage is only valid for Work Cells roles: {source_path}")
    derivation_file = resolve_repository_path(derivation_path)
    derivation_bytes = derivation_file.read_bytes()
    source_hash = sha256_bytes(derivation_bytes)
    if source_hash != validate_hash(
        derivation_record.get("sha256"),
        f"Inventory derivation hash for {derivation_path}",
    ):
        raise ValueError(f"Inventory derivation source hash is stale: {derivation_path}")
    if len(derivation_bytes) != derivation_record.get("bytes"):
        raise ValueError(f"Inventory derivation source byte count is stale: {derivation_path}")
    image, metadata = inspect_source_image(derivation_file)
    assert_inventory_metadata(derivation_record, metadata, derivation_path)
    if (
        lineage_kind == "work-cells-high-resolution-counterpart"
        and (
            metadata["width"] <= reference_metadata["width"]
            or metadata["height"] <= reference_metadata["height"]
        )
    ):
        raise ValueError(
            f"High-resolution derivation source is not strictly larger than its "
            f"logical thumbnail: {derivation_path}"
        )
    if metadata["animated"] and policy.get("animationStrategy") != "first-frame":
        raise ValueError(
            f"Animated derivation source {derivation_path} requires an accepted "
            "animationStrategy=first-frame policy."
        )

    variants = []
    seen_profile_ids: set[str] = set()
    for profile in profiles:
        profile_id = str(profile["id"])
        if profile_id in seen_profile_ids:
            raise ValueError(
                f"Duplicate source/profile generation request: {source_path}:{profile_id}"
            )
        seen_profile_ids.add(profile_id)
        resized = resize_image(image, int(profile["width"]))
        output_format = normalized_format(profile["format"])
        derivative_path = derivative_repository_path(
            source_path,
            source_hash,
            policy_hash,
            profile_id,
            output_format,
        )
        relative_inside_media = Path(derivative_path).relative_to("public/media")
        target = assert_allowed_output(output_root / relative_inside_media)
        options = encoder_options(profile)
        if write_files:
            output_metadata = save_variant(
                resized,
                target,
                profile,
                policy["alphaStrategy"]["flattenColor"],
            )
            variant_bytes = target.stat().st_size
            variant_hash = sha256_file(target)
        else:
            prepared, alpha_preserved = prepare_mode(
                resized,
                output_format,
                bool(profile["preserveAlpha"]),
                policy["alphaStrategy"]["flattenColor"],
            )
            output_metadata = {
                "mode": prepared.mode,
                "hasAlpha": image_has_alpha(prepared),
                "alphaPreserved": alpha_preserved,
            }
            variant_bytes = 0
            variant_hash = "0" * 64
        variants.append(
            {
                "profileId": profile_id,
                "path": derivative_path,
                "width": resized.width,
                "height": resized.height,
                "format": output_format,
                "mode": output_metadata["mode"],
                "hasAlpha": output_metadata["hasAlpha"],
                "alphaPreserved": output_metadata["alphaPreserved"],
                "bytes": variant_bytes,
                "sha256": variant_hash,
                "roles": profile["matchingRoles"],
                "sourceHash": source_hash,
                "encoderOptions": options,
                **(
                    {"lossless": bool(options["lossless"])}
                    if "lossless" in options
                    else {}
                ),
                **(
                    {"quality": int(options["quality"])}
                    if "quality" in options
                    else {}
                ),
            }
        )
    variants.sort(
        key=lambda item: (
            ",".join(item["roles"]),
            item["width"],
            item["format"],
            item["profileId"],
            item["path"],
        )
    )
    fallbacks_by_role = choose_role_fallbacks(roles, variants, policy)
    return {
        "sourcePath": source_path,
        "referenceHash": reference_hash,
        "referenceStoredWidth": reference_metadata["storedWidth"],
        "referenceStoredHeight": reference_metadata["storedHeight"],
        "referenceWidth": reference_metadata["width"],
        "referenceHeight": reference_metadata["height"],
        "referenceBytes": len(reference_bytes),
        "referenceFormat": reference_metadata["decodedFormat"],
        "referenceMode": reference_metadata["mode"],
        "referenceHasAlpha": reference_metadata["hasAlpha"],
        "referenceExifOrientation": reference_metadata["exifOrientation"],
        "referenceOrientationNormalized": reference_metadata["orientationNormalized"],
        "referenceFrames": reference_metadata["frameCount"],
        "referenceAnimated": reference_metadata["animated"],
        "lineageKind": lineage_kind,
        "derivationSourcePath": derivation_path,
        "sourceHash": source_hash,
        "sourceStoredWidth": metadata["storedWidth"],
        "sourceStoredHeight": metadata["storedHeight"],
        "sourceWidth": metadata["width"],
        "sourceHeight": metadata["height"],
        "sourceBytes": len(derivation_bytes),
        "sourceFormat": metadata["decodedFormat"],
        "sourceMode": metadata["mode"],
        "hasAlpha": metadata["hasAlpha"],
        "exifOrientation": metadata["exifOrientation"],
        "orientationNormalized": metadata["orientationNormalized"],
        "sourceFrames": metadata["frameCount"],
        "animated": metadata["animated"],
        "roles": roles,
        "fallbackPath": fallbacks_by_role[roles[0]],
        "fallbacksByRole": fallbacks_by_role,
        "variants": variants,
    }


def build_manifest(
    inventory: dict[str, Any],
    policy: dict[str, Any],
    output_root: Path,
    sample_filter: str | None,
    role_filter: str | None,
    write_files: bool,
) -> dict[str, Any]:
    if inventory.get("schemaVersion") != 2:
        raise ValueError("Run the schemaVersion 2 Pillow-enriched media inventory first.")
    if (inventory.get("counts") or {}).get("missingReferencedImages") != 0:
        raise ValueError("Media inventory contains missing referenced images.")
    if (inventory.get("counts") or {}).get("corruptImages") != 0:
        raise ValueError("Media inventory contains corrupt referenced images.")
    policy_hash = canonical_hash(policy)
    entries = []
    for record in sorted(inventory.get("media") or [], key=lambda item: str(item["path"])):
        entry = create_entry(
            record,
            policy,
            policy_hash,
            output_root,
            sample_filter,
            role_filter,
            write_files,
        )
        if entry:
            entries.append(entry)
    if not entries:
        raise ValueError("No media sources matched the requested generation scope.")
    derivative_owners: dict[str, str] = {}
    for entry in entries:
        for variant in entry["variants"]:
            owner = f"{entry['sourcePath']}:{variant['profileId']}"
            previous = derivative_owners.setdefault(variant["path"], owner)
            if previous != owner:
                raise ValueError(
                    f"Derivative path collision: {variant['path']} "
                    f"belongs to both {previous} and {owner}."
                )
    manifest = {
        "schemaVersion": 2,
        "generatorVersion": GENERATOR_VERSION,
        "policyHash": policy_hash,
        "toolVersions": {
            "python": PYTHON_VERSION,
            "pillow": PILLOW_VERSION,
            "libwebp": LIBWEBP_VERSION,
        },
        "media": entries,
    }
    manifest["totals"] = {
        "sources": len(entries),
        "referenceBytes": sum(entry["referenceBytes"] for entry in entries),
        "sourceBytes": sum(entry["sourceBytes"] for entry in entries),
        "variants": sum(len(entry["variants"]) for entry in entries),
        "derivativeBytes": sum(
            variant["bytes"] for entry in entries for variant in entry["variants"]
        ),
    }
    return manifest


def expected_variant_paths(manifest: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        Path(variant["path"]).relative_to("public/media").as_posix(): variant
        for entry in manifest["media"]
        for variant in entry["variants"]
    }


def validate_staging(
    staging_media_root: Path,
    manifest: dict[str, Any],
    policy: dict[str, Any],
) -> None:
    if manifest["policyHash"] != canonical_hash(policy):
        raise ValueError("Staging manifest policyHash does not match the accepted policy.")
    if manifest["toolVersions"] != {
        "python": PYTHON_VERSION,
        "pillow": PILLOW_VERSION,
        "libwebp": LIBWEBP_VERSION,
    }:
        raise ValueError("Staging manifest toolVersions do not match the active runtime.")
    expected = expected_variant_paths(manifest)
    actual_root = staging_media_root / "derived"
    actual = {
        path.relative_to(staging_media_root).as_posix()
        for path in actual_root.rglob("*")
        if path.is_file()
    }
    if set(expected) != actual:
        missing = sorted(set(expected) - actual)
        extra = sorted(actual - set(expected))
        raise ValueError(
            f"Staging derivative tree mismatch; missing={missing[:5]}, extra={extra[:5]}"
        )
    for relative_path, variant in expected.items():
        candidate = staging_media_root / relative_path
        if candidate.stat().st_size != variant["bytes"]:
            raise ValueError(f"Staging derivative byte count mismatch: {relative_path}")
        if sha256_file(candidate) != variant["sha256"]:
            raise ValueError(f"Staging derivative hash mismatch: {relative_path}")
        with Image.open(candidate) as image:
            image.load()
            actual_format = normalized_format(
                image.format or candidate.suffix.lstrip(".")
            )
            if (
                image.width != variant["width"]
                or image.height != variant["height"]
                or actual_format != variant["format"]
                or image.mode != variant["mode"]
                or image_has_alpha(image) != variant["hasAlpha"]
            ):
                raise ValueError(f"Staging derivative metadata mismatch: {relative_path}")
    expected_manifest = canonical_json(manifest)
    manifest_path = staging_media_root / "media-manifest.json"
    if not manifest_path.is_file() or manifest_path.read_bytes() != expected_manifest:
        raise ValueError("Staging media manifest bytes are missing or stale.")
    for entry in manifest["media"]:
        reference = resolve_repository_path(entry["sourcePath"])
        if (
            reference.stat().st_size != entry["referenceBytes"]
            or sha256_file(reference) != entry["referenceHash"]
        ):
            raise ValueError(
                f"Logical reference changed during generation: {entry['sourcePath']}"
            )
        source = resolve_repository_path(entry["derivationSourcePath"])
        if (
            source.stat().st_size != entry["sourceBytes"]
            or sha256_file(source) != entry["sourceHash"]
        ):
            raise ValueError(
                f"Derivation source changed during generation: "
                f"{entry['derivationSourcePath']}"
            )


def compare_tree(
    actual_root: Path,
    manifest: dict[str, Any],
) -> list[str]:
    findings: list[str] = []
    expected = expected_variant_paths(manifest)
    actual_derived = actual_root / "derived"
    actual_paths = (
        {
            path.relative_to(actual_root).as_posix()
            for path in actual_derived.rglob("*")
            if path.is_file()
        }
        if actual_derived.exists()
        else set()
    )
    for relative_path, variant in expected.items():
        candidate = actual_root / relative_path
        if not candidate.is_file():
            findings.append(f"missing:{relative_path}")
            continue
        if (
            candidate.stat().st_size != variant["bytes"]
            or sha256_file(candidate) != variant["sha256"]
        ):
            findings.append(f"stale:{relative_path}")
    for relative_path in sorted(actual_paths - set(expected)):
        findings.append(f"extra:{relative_path}")
    expected_manifest = canonical_json(manifest)
    actual_manifest = actual_root / "media-manifest.json"
    if not actual_manifest.is_file():
        findings.append("missing:media-manifest.json")
    elif actual_manifest.read_bytes().replace(b"\r\n", b"\n") != expected_manifest:
        findings.append("stale:media-manifest.json")
    return findings


def remove_file_or_tree(path: Path) -> None:
    if path.is_dir():
        shutil.rmtree(path)
    else:
        path.unlink(missing_ok=True)


def validate_installed_media(staging_media_root: Path) -> None:
    manifest = load_json(staging_media_root / "media-manifest.json")
    findings = compare_tree(ROOT / "public/media", manifest)
    if findings:
        raise ValueError(
            "Installed responsive media differs from the validated staging tree: "
            f"{findings[:5]}"
        )


def available_backup_path(preferred: Path) -> Path:
    """Return a non-existing backup path without deleting recovery evidence."""
    if not preferred.exists():
        return preferred
    counter = 1
    while True:
        candidate = preferred.with_name(f"{preferred.name}.{counter}")
        if not candidate.exists():
            return candidate
        counter += 1


def atomic_install(staging_media_root: Path) -> list[str]:
    final_media_root = assert_allowed_output(ROOT / "public/media")
    final_media_root.mkdir(parents=True, exist_ok=True)
    staged_derived = staging_media_root / "derived"
    staged_manifest = staging_media_root / "media-manifest.json"
    replacement_derived = final_media_root / ".fr-p5-derived-replacement"
    replacement_manifest = final_media_root / ".fr-p5-manifest-replacement.json"
    backup_root = staging_media_root.parent / ".fr-p5-install-backups"
    backup_root.mkdir(parents=True, exist_ok=True)
    if backup_root.stat().st_dev != final_media_root.stat().st_dev:
        raise ValueError(
            "Responsive media staging and public/media must be on the same volume "
            "for atomic backup moves."
        )
    backup_derived = available_backup_path(
        backup_root / ".fr-p5-derived-backup"
    )
    backup_manifest = available_backup_path(
        backup_root / ".fr-p5-manifest-backup.json"
    )
    transaction_paths = (
        replacement_derived,
        replacement_manifest,
    )
    stale = [repository_path(path) for path in transaction_paths if path.exists()]
    if stale:
        raise ValueError(
            "Refusing to overwrite stale FR-P5 transaction paths; inspect and "
            f"recover them first: {stale}"
        )
    had_derived = DERIVED_ROOT.exists()
    had_manifest = MANIFEST_PATH.exists()
    replacement_derived_started = False
    replacement_manifest_started = False
    derived_backup_moved = False
    manifest_backup_moved = False
    derived_installed = False
    manifest_installed = False
    try:
        replacement_derived_started = True
        shutil.copytree(staged_derived, replacement_derived)
        replacement_manifest_started = True
        shutil.copyfile(staged_manifest, replacement_manifest)
        if had_derived:
            os.replace(DERIVED_ROOT, backup_derived)
            derived_backup_moved = True
        if had_manifest:
            os.replace(MANIFEST_PATH, backup_manifest)
            manifest_backup_moved = True
        os.replace(replacement_derived, DERIVED_ROOT)
        derived_installed = True
        os.replace(replacement_manifest, MANIFEST_PATH)
        manifest_installed = True
        validate_installed_media(staging_media_root)
    except BaseException as install_error:
        recovery_errors: list[str] = []

        def recover(label: str, action: Any) -> None:
            try:
                action()
            except BaseException as recovery_error:
                recovery_errors.append(f"{label}: {recovery_error}")

        # Remove only outputs that this transaction successfully installed.
        # A path whose backup move failed may still be the original and must
        # never be inferred from existence alone.
        if manifest_installed:
            recover(
                "remove installed manifest",
                lambda: remove_file_or_tree(MANIFEST_PATH),
            )
        if derived_installed:
            recover(
                "remove installed derivative tree",
                lambda: remove_file_or_tree(DERIVED_ROOT),
            )

        # Restore only backups whose corresponding move completed.
        if manifest_backup_moved:
            recover(
                "restore manifest backup",
                lambda: os.replace(backup_manifest, MANIFEST_PATH),
            )
        if derived_backup_moved:
            recover(
                "restore derivative backup",
                lambda: os.replace(backup_derived, DERIVED_ROOT),
            )

        # Replacement paths were proven absent before the transaction. They
        # are therefore safe to clean even when a copy failed partway through.
        if replacement_manifest_started:
            recover(
                "remove manifest replacement",
                lambda: remove_file_or_tree(replacement_manifest),
            )
        if replacement_derived_started:
            recover(
                "remove derivative replacement",
                lambda: remove_file_or_tree(replacement_derived),
            )
        if recovery_errors:
            raise RuntimeError(
                "Responsive media install failed and rollback was incomplete: "
                + "; ".join(recovery_errors)
            ) from install_error
        raise
    # Commit boundary: the replacement tree and manifest are authoritative once
    # validate_installed_media succeeds. Backups live only in the unique scratch
    # transaction, never in the literal public-media closure. Their cleanup is
    # post-commit hygiene; it must never enter rollback or turn a validated
    # install into a failed generation. Unique backup names keep later safe runs
    # unblocked while preserving any cleanup leftovers for manual recovery.
    cleanup_warnings: list[str] = []
    for label, moved, backup_path in (
        ("derivative backup", derived_backup_moved, backup_derived),
        ("manifest backup", manifest_backup_moved, backup_manifest),
    ):
        if not moved:
            continue
        try:
            remove_file_or_tree(backup_path)
        except Exception as cleanup_error:
            cleanup_warnings.append(
                f"Committed responsive media install; could not remove "
                f"{label} {repository_path(backup_path)}: {cleanup_error}"
            )
    try:
        backup_root.rmdir()
    except OSError as cleanup_error:
        try:
            backup_root_nonempty = backup_root.exists() and any(
                backup_root.iterdir()
            )
        except OSError:
            backup_root_nonempty = False
        if not backup_root_nonempty:
            cleanup_warnings.append(
                f"Committed responsive media install; could not remove empty "
                f"backup root {repository_path(backup_root)}: {cleanup_error}"
            )
    return cleanup_warnings


def install_scratch_preview(staging_media_root: Path, output_root: Path) -> None:
    output = assert_scratch_preview_output(output_root)
    if output.exists():
        if any(output.iterdir()):
            raise ValueError(
                f"Scratch preview output must be absent or empty: {repository_path(output)}"
            )
        output.rmdir()
    output.parent.mkdir(parents=True, exist_ok=True)
    os.replace(staging_media_root, output)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument("--write", action="store_true")
    modes.add_argument("--check", action="store_true")
    modes.add_argument("--dry-run", action="store_true")
    modes.add_argument("--output")
    parser.add_argument("--sample")
    parser.add_argument("--role", choices=sorted(MEDIA_ROLES))
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if (args.write or args.check) and (args.sample or args.role):
        raise SystemExit("--sample/--role are allowed only with --dry-run or --output.")
    if not INVENTORY_PATH.is_file():
        raise SystemExit("Run `npm run inventory:media -- --write` before media generation.")
    if not POLICY_PATH.is_file():
        raise SystemExit("The accepted FR-P5 media quality policy is missing.")
    inventory = load_json(INVENTORY_PATH)
    policy = load_json(POLICY_PATH)
    validate_policy(policy)

    if args.dry_run:
        manifest = build_manifest(
            inventory,
            policy,
            ROOT / "public/media",
            args.sample,
            args.role,
            False,
        )
        print(
            json.dumps(
                {
                    "mode": "dry-run-no-writes",
                    "pythonVersion": PYTHON_VERSION,
                    "pillowVersion": PILLOW_VERSION,
                    "libwebpVersion": LIBWEBP_VERSION,
                    "policyHash": manifest["policyHash"],
                    "sources": manifest["totals"]["sources"],
                    "variants": manifest["totals"]["variants"],
                    "sample": args.sample,
                    "role": args.role,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0

    SCRATCH_ROOT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(
        prefix="generate-",
        dir=SCRATCH_ROOT,
        ignore_cleanup_errors=True,
    ) as temp:
        staging = Path(temp) / "media"
        (staging / "derived").mkdir(parents=True, exist_ok=True)
        manifest = build_manifest(
            inventory,
            policy,
            staging,
            args.sample,
            args.role,
            True,
        )
        (staging / "media-manifest.json").write_bytes(canonical_json(manifest))
        validate_staging(staging, manifest, policy)

        if args.output:
            output_argument = Path(args.output)
            output_root = (
                output_argument.resolve()
                if output_argument.is_absolute()
                else (ROOT / output_argument).resolve()
            )
            install_scratch_preview(staging, output_root)
            print(repository_path(output_root / "media-manifest.json"))
            return 0
        if args.check:
            findings = compare_tree(ROOT / "public/media", manifest)
            if findings:
                for finding in findings:
                    print(finding, file=sys.stderr)
                return 1
            print("Responsive media derivatives and manifest are current.")
            return 0
        cleanup_warnings = atomic_install(staging)
        for warning in cleanup_warnings:
            print(f"WARNING: {warning}", file=sys.stderr)
        print(
            f"Generated {manifest['totals']['variants']} variants for "
            f"{manifest['totals']['sources']} sources."
        )
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
