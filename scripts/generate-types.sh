#!/bin/bash
# Generate TypeScript types from versioned OpenAPI specifications.
#
# Usage:
#   ./scripts/generate-types.sh           # process all version directories
#   ./scripts/generate-types.sh 25r2      # process a single version (case-insensitive)
#   ./scripts/generate-types.sh 26r1
#
# Source:  $OPENAPI_BASE/{VERSION}/ (set env var, or place in ./openapi-specs/)
# Output:  ./src/generated/{version}/      (lowercase version name)
#
# BMS version naming conventions handled:
#   25R2: bConnect_{Service}.json  (prefix + CamelCase)
#   26R1: {service}.json           (lowercase, no prefix)
#
# See docs/ADR-006-Multi-Version-OpenAPI.md for design rationale.

set -euo pipefail

# ──────────────────────────────────────────────────────────────
# Paths
# ──────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

OPENAPI_BASE="${OPENAPI_BASE:-${PROJECT_ROOT}/openapi-specs}"
OUTPUT_BASE="${PROJECT_ROOT}/src/generated"
OT_CLI="${PROJECT_ROOT}/node_modules/openapi-typescript/bin/cli.js"

# ──────────────────────────────────────────────────────────────
# Spec-basename → output-name mapping
#
# Key:   filename without .json extension (exactly as on disk)
# Value: output basename without .types.ts extension
#
# Covers both naming conventions:
#   25R2  →  bConnect_{Service}.json
#   26R1  →  {service}.json
# ──────────────────────────────────────────────────────────────
declare -A SPEC_TO_OUTPUT=(
    # ---- BMS 25R2 (bConnect_ prefix + CamelCase) ----
    ["bConnect_ActiveDirectory"]="active-directory"
    ["bConnect_Assets"]="assets"
    ["bConnect_DefenseControl"]="defense-control"
    ["bConnect_Endpoints"]="endpoints"
    ["bConnect_Jobs"]="jobs"
    ["bConnect_OperatingSystems"]="operating-systems"
    ["bConnect_ServerManagement"]="server-management"
    ["bConnect_Software"]="software"
    ["bConnect_UpdateManagement"]="update-management"
    ["bConnect_Variables"]="variables"

    # ---- BMS 26R1 (lowercase, no prefix) ----
    ["activedirectory"]="active-directory"
    ["assets"]="assets"
    ["compliance"]="compliance"
    ["defensecontrol"]="defense-control"
    ["endpoints"]="endpoints"
    ["jobs"]="jobs"
    ["operatingsystems"]="operating-systems"
    ["servermanagement"]="server-management"
    ["software"]="software"
    ["universaldynamicgroups"]="universaldynamicgroups"
    ["updatemanagement"]="update-management"
    ["variables"]="variables"
)

# ──────────────────────────────────────────────────────────────
# process_version <VERSION_DIR_NAME>
#   Generates types for one version directory.
#   VERSION_DIR_NAME: exact name of the subdir in OPENAPI_BASE (e.g. "25R2")
# ──────────────────────────────────────────────────────────────
process_version() {
    local version_dir_name="$1"
    local spec_dir="${OPENAPI_BASE}/${version_dir_name}"

    # Output directory uses lowercase version name (matches BmsVersion enum values)
    local version_lower
    version_lower="$(echo "${version_dir_name}" | tr '[:upper:]' '[:lower:]')"
    local output_dir="${OUTPUT_BASE}/${version_lower}"

    if [ ! -d "${spec_dir}" ]; then
        echo "  ⚠️  Spec directory not found: ${spec_dir} — skipping"
        return 1
    fi

    echo ""
    echo "📦 BMS ${version_dir_name}  →  src/generated/${version_lower}/"
    echo "   Source : ${spec_dir}"
    echo "   Output : ${output_dir}"

    mkdir -p "${output_dir}"

    local count=0
    local skipped=0

    for spec_file in "${spec_dir}"/*.json; do
        # Guard: skip if glob found nothing
        [ -f "${spec_file}" ] || { echo "   (no .json files found)"; break; }

        local basename
        basename="$(basename "${spec_file}" .json)"
        local output_name="${SPEC_TO_OUTPUT[${basename}]:-}"

        if [ -z "${output_name}" ]; then
            echo "   ⚠️  No mapping for '${basename}.json' — skipping"
            echo "       Add entry to SPEC_TO_OUTPUT in scripts/generate-types.sh"
            skipped=$((skipped + 1))
            continue
        fi

        local output_file="${output_dir}/${output_name}.types.ts"
        echo "   🔧  ${basename}.json → ${output_name}.types.ts"
        node "${OT_CLI}" "${spec_file}" --output "${output_file}"
        count=$((count + 1))
    done

    echo "   ✅  ${count} type file(s) generated, ${skipped} skipped"
}

# ──────────────────────────────────────────────────────────────
# Validate prerequisites
# ──────────────────────────────────────────────────────────────
if [ ! -d "${OPENAPI_BASE}" ]; then
    echo "❌ OpenAPI spec base directory not found: ${OPENAPI_BASE}"
    echo "   Expected versioned subdirectories, e.g.:"
    echo "     ${OPENAPI_BASE}/25R2/"
    echo "     ${OPENAPI_BASE}/26R1/"
    exit 1
fi

if [ ! -f "${OT_CLI}" ]; then
    echo "❌ openapi-typescript not found: ${OT_CLI}"
    echo "   Run: npm install"
    exit 1
fi

# ──────────────────────────────────────────────────────────────
# Main — process one specific version or all discovered versions
# ──────────────────────────────────────────────────────────────
echo "🔧 Generating TypeScript types from versioned OpenAPI specifications"
echo "   Spec base : ${OPENAPI_BASE}"
echo "   Type base : ${OUTPUT_BASE}"

if [ -n "${1:-}" ]; then
    # Single version argument (case-insensitive match)
    ARG="$1"
    if [ -d "${OPENAPI_BASE}/${ARG}" ]; then
        process_version "${ARG}"
    else
        # Try uppercase match (user may pass "25r2", dir is "25R2")
        ARG_UPPER="$(echo "${ARG}" | tr '[:lower:]' '[:upper:]')"
        if [ -d "${OPENAPI_BASE}/${ARG_UPPER}" ]; then
            process_version "${ARG_UPPER}"
        else
            echo "❌ Version not found: ${ARG}"
            echo "   Available versions:"
            for d in "${OPENAPI_BASE}"/*/; do
                [ -d "${d}" ] && echo "     - $(basename "${d}")"
            done
            exit 1
        fi
    fi
else
    # Auto-detect all version subdirectories
    version_count=0
    for version_dir in "${OPENAPI_BASE}"/*/; do
        [ -d "${version_dir}" ] || continue
        process_version "$(basename "${version_dir}")"
        version_count=$((version_count + 1))
    done

    if [ "${version_count}" -eq 0 ]; then
        echo "❌ No version directories found under ${OPENAPI_BASE}"
        exit 1
    fi
fi

# ──────────────────────────────────────────────────────────────
# Summary
# ──────────────────────────────────────────────────────────────
echo ""
echo "📊 Summary"
if [ -d "${OUTPUT_BASE}" ]; then
    for version_dir in "${OUTPUT_BASE}"/*/; do
        [ -d "${version_dir}" ] || continue
        file_count="$(find "${version_dir}" -maxdepth 1 -name '*.types.ts' | wc -l | tr -d ' ')"
        echo "   src/generated/$(basename "${version_dir}")/ : ${file_count} type file(s)"
    done
else
    echo "   (no output directory found)"
fi
echo ""
echo "✅ Type generation complete!"
echo ""
echo "Next steps:"
echo "   1. Run 'npm run build' to verify types compile"
echo "   2. Import types: import type { ... } from './generated/25r2/endpoints.types'"
echo "   3. See docs/ADR-006-Multi-Version-OpenAPI.md for version-aware usage"
