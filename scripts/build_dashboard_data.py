#!/usr/bin/env python3
import argparse
import glob
import json
import os
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


CHARACTER_LABELS = {
    "IRONCLAD": "Ironclad",
    "SILENT": "Silent",
    "DEFECT": "Defect",
    "REGENT": "Regent",
    "NECROBINDER": "Necrobinder",
}

ROOM_TYPE_LABELS = {
    "monster": "Monster",
    "event": "Event",
    "rest_site": "Rest Site",
    "shop": "Shop",
    "elite": "Elite",
    "treasure": "Treasure",
    "boss": "Boss",
    "unknown": "Unknown",
    "ancient": "Ancient",
    "UNKNOWN": "Unknown",
}


def default_history_glob() -> str:
    user_profile = os.environ.get("USERPROFILE")
    if not user_profile:
        raise RuntimeError("USERPROFILE is not set")
    return os.path.join(
        user_profile,
        "AppData",
        "Roaming",
        "SlayTheSpire2",
        "steam",
        "*",
        "profile*",
        "saves",
        "history",
        "*.run",
    )


def normalize_id(raw):
    if not raw:
        return "UNKNOWN"
    return str(raw)


def simplify_character(raw):
    text = normalize_id(raw)
    if "." in text:
        return text.split(".", 1)[1]
    return text


def character_label(character_key):
    return CHARACTER_LABELS.get(character_key, title_from_token(character_key))


def title_from_token(token):
    text = normalize_id(token)
    text = text.split(".")[-1]
    text = text.replace("-", "_")
    parts = [p for p in text.split("_") if p]
    if not parts:
        return text
    return " ".join(p.capitalize() for p in parts)


def item_name(raw_id):
    return title_from_token(raw_id)


def epoch_to_iso(epoch_value):
    try:
        if epoch_value is None:
            return None
        return datetime.fromtimestamp(float(epoch_value), tz=timezone.utc).isoformat()
    except Exception:
        return None


def to_floor_rows(map_point_history):
    rows = []
    floor = 0
    for act_idx, act in enumerate(map_point_history or [], start=1):
        if not isinstance(act, list):
            continue
        for point in act:
            if not isinstance(point, dict):
                continue
            floor += 1
            rooms = point.get("rooms") or []
            room = rooms[0] if rooms else {}
            rows.append(
                {
                    "act": act_idx,
                    "floor": floor,
                    "map_point_type": normalize_id(point.get("map_point_type")),
                    "room_type": normalize_id(room.get("room_type")),
                    "model_id": normalize_id(room.get("model_id")),
                    "turns_taken": room.get("turns_taken"),
                }
            )
    return rows


def finalize_presence_stats(stats_map):
    rows = []
    for key, values in stats_map.items():
        runs = values["runs"]
        wins = values["wins"]
        copies_total = values["copies_total"]
        rows.append(
            {
                "id": key,
                "name": item_name(key),
                "runs_with": runs,
                "win_rate": round((wins / runs) * 100, 2) if runs else 0.0,
                "avg_copies": round(copies_total / runs, 2) if runs else 0.0,
            }
        )
    rows.sort(key=lambda x: (-x["runs_with"], -x["win_rate"], x["name"]))
    return rows


def finalize_presence_stats_by_character(stats_map):
    output = {}
    for character_key, char_map in stats_map.items():
        output[character_key] = finalize_presence_stats(char_map)
    return output


def cumulative_series(runs, key_selector):
    grouped = defaultdict(list)
    for run in runs:
        grouped[key_selector(run)].append(run)

    output = {}
    for key, entries in grouped.items():
        entries.sort(key=lambda r: (r["start_time"] or 0, r["run_id"]))
        wins = 0
        total = 0
        points = []
        for idx, r in enumerate(entries, start=1):
            total += 1
            wins += 1 if r["win"] else 0
            points.append(
                {
                    "x": idx,
                    "run_id": r["run_id"],
                    "timestamp": r["start_time_iso"],
                    "win_rate": round((wins / total) * 100, 2),
                    "runs": total,
                }
            )
        output[key] = points
    return output


def main():
    parser = argparse.ArgumentParser(description="Build aggregated dashboard data from STS2 run files")
    parser.add_argument("--glob", dest="glob_pattern", default=default_history_glob(), help="Glob for .run files")
    parser.add_argument("--out", default="data/dashboard_data.json", help="Output JSON file")
    args = parser.parse_args()

    run_files = sorted(glob.glob(args.glob_pattern))
    if not run_files:
        raise SystemExit(f"No .run files found with pattern: {args.glob_pattern}")

    runs = []

    character_counter = Counter()
    character_win_counter = Counter()
    asc_counter = Counter()
    asc_win_counter = Counter()

    floor_reached_counter = Counter()
    floor_win_counter = Counter()
    floor_survival_counter = Counter()

    room_type_counter = Counter()
    room_type_win_counter = Counter()

    encounter_counter = Counter()
    encounter_win_counter = Counter()
    encounter_counter_by_character = defaultdict(Counter)
    encounter_win_counter_by_character = defaultdict(Counter)

    card_presence = defaultdict(lambda: {"runs": 0, "wins": 0, "copies_total": 0})
    relic_presence = defaultdict(lambda: {"runs": 0, "wins": 0, "copies_total": 0})
    card_presence_by_character = defaultdict(lambda: defaultdict(lambda: {"runs": 0, "wins": 0, "copies_total": 0}))
    relic_presence_by_character = defaultdict(lambda: defaultdict(lambda: {"runs": 0, "wins": 0, "copies_total": 0}))

    for run_path in run_files:
        with open(run_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        players = data.get("players") or [{}]
        p0 = players[0] if players else {}
        win = bool(data.get("win", False))

        character = simplify_character(p0.get("character"))
        ascension = data.get("ascension")
        run_id = Path(run_path).stem
        start_time = data.get("start_time")
        run_time = data.get("run_time")
        floor_rows = to_floor_rows(data.get("map_point_history"))
        floor_reached = floor_rows[-1]["floor"] if floor_rows else 0

        row = {
            "run_id": run_id,
            "file": run_path,
            "start_time": start_time,
            "start_time_iso": epoch_to_iso(start_time),
            "run_time_seconds": run_time,
            "run_time_minutes": round((run_time or 0) / 60.0, 2) if run_time is not None else None,
            "character": character,
            "character_name": character_label(character),
            "ascension": ascension,
            "build_id": data.get("build_id"),
            "game_mode": data.get("game_mode"),
            "win": win,
            "was_abandoned": bool(data.get("was_abandoned", False)),
            "killed_by_encounter": data.get("killed_by_encounter"),
            "killed_by_encounter_name": item_name(data.get("killed_by_encounter")),
            "killed_by_event": data.get("killed_by_event"),
            "killed_by_event_name": item_name(data.get("killed_by_event")),
            "acts": [simplify_character(a) for a in data.get("acts", [])],
            "floor_reached": floor_reached,
            "deck_count": len(p0.get("deck") or []),
            "relic_count": len(p0.get("relics") or []),
        }
        runs.append(row)

        character_counter[character] += 1
        character_win_counter[character] += 1 if win else 0

        asc_key = str(ascension)
        asc_counter[asc_key] += 1
        asc_win_counter[asc_key] += 1 if win else 0

        for floor in range(1, floor_reached + 1):
            floor_reached_counter[floor] += 1
            floor_survival_counter[floor] += 1 if floor_reached >= floor else 0
            floor_win_counter[floor] += 1 if win else 0

        for fr in floor_rows:
            rt = fr["room_type"]
            room_type_counter[rt] += 1
            room_type_win_counter[rt] += 1 if win else 0

            model = fr["model_id"]
            if model and model != "?" and model != "UNKNOWN":
                encounter_counter[model] += 1
                encounter_win_counter[model] += 1 if win else 0
                encounter_counter_by_character[character][model] += 1
                encounter_win_counter_by_character[character][model] += 1 if win else 0

        deck_counter = Counter()
        for c in p0.get("deck") or []:
            if isinstance(c, dict):
                deck_counter[normalize_id(c.get("id"))] += 1
        for cid, copies in deck_counter.items():
            card_presence[cid]["runs"] += 1
            card_presence[cid]["copies_total"] += copies
            card_presence[cid]["wins"] += 1 if win else 0

            card_presence_by_character[character][cid]["runs"] += 1
            card_presence_by_character[character][cid]["copies_total"] += copies
            card_presence_by_character[character][cid]["wins"] += 1 if win else 0

        relic_counter = Counter()
        for r in p0.get("relics") or []:
            if isinstance(r, dict):
                relic_counter[normalize_id(r.get("id"))] += 1
        for rid, copies in relic_counter.items():
            relic_presence[rid]["runs"] += 1
            relic_presence[rid]["copies_total"] += copies
            relic_presence[rid]["wins"] += 1 if win else 0

            relic_presence_by_character[character][rid]["runs"] += 1
            relic_presence_by_character[character][rid]["copies_total"] += copies
            relic_presence_by_character[character][rid]["wins"] += 1 if win else 0

    runs.sort(key=lambda r: (r["start_time"] or 0, r["run_id"]))

    total_runs = len(runs)
    total_wins = sum(1 for r in runs if r["win"])

    winrate_over_time = {
        "overall": cumulative_series(runs, lambda _: "overall")["overall"],
        "by_character": cumulative_series(runs, lambda r: r["character"]),
    }

    by_character = []
    for character, count in character_counter.items():
        wins = character_win_counter[character]
        by_character.append(
            {
                "character": character,
                "character_name": character_label(character),
                "runs": count,
                "wins": wins,
                "win_rate": round((wins / count) * 100, 2) if count else 0.0,
            }
        )
    by_character.sort(key=lambda x: (-x["runs"], -x["win_rate"], x["character"]))

    by_ascension = []
    for asc, count in asc_counter.items():
        wins = asc_win_counter[asc]
        by_ascension.append(
            {
                "ascension": int(asc) if str(asc).isdigit() else asc,
                "runs": count,
                "wins": wins,
                "win_rate": round((wins / count) * 100, 2) if count else 0.0,
            }
        )
    by_ascension.sort(key=lambda x: x["ascension"] if isinstance(x["ascension"], int) else 999)

    max_floor = max(floor_reached_counter.keys()) if floor_reached_counter else 0
    floor_stats = []
    for floor in range(1, max_floor + 1):
        reached = floor_reached_counter[floor]
        wins = floor_win_counter[floor]
        survived = floor_survival_counter[floor]
        floor_stats.append(
            {
                "floor": floor,
                "runs_reached": reached,
                "wins_from_here": wins,
                "win_rate_from_here": round((wins / reached) * 100, 2) if reached else 0.0,
                "survival_rate": round((survived / total_runs) * 100, 2) if total_runs else 0.0,
            }
        )

    room_stats = []
    for room_type, visits in room_type_counter.items():
        wins = room_type_win_counter[room_type]
        room_stats.append(
            {
                "room_type": room_type,
                "room_type_name": ROOM_TYPE_LABELS.get(room_type, title_from_token(room_type)),
                "visits": visits,
                "win_rate": round((wins / visits) * 100, 2) if visits else 0.0,
            }
        )
    room_stats.sort(key=lambda x: (-x["visits"], -x["win_rate"], x["room_type_name"]))

    encounter_stats = []
    for model, visits in encounter_counter.items():
        wins = encounter_win_counter[model]
        encounter_stats.append(
            {
                "encounter": model,
                "encounter_name": item_name(model),
                "visits": visits,
                "win_rate": round((wins / visits) * 100, 2) if visits else 0.0,
            }
        )
    encounter_stats.sort(key=lambda x: (-x["visits"], -x["win_rate"], x["encounter_name"]))

    encounter_stats_by_character = {}
    for character_key, c_counter in encounter_counter_by_character.items():
        rows = []
        for model, visits in c_counter.items():
            wins = encounter_win_counter_by_character[character_key][model]
            rows.append(
                {
                    "encounter": model,
                    "encounter_name": item_name(model),
                    "visits": visits,
                    "win_rate": round((wins / visits) * 100, 2) if visits else 0.0,
                }
            )
        rows.sort(key=lambda x: (-x["visits"], -x["win_rate"], x["encounter_name"]))
        encounter_stats_by_character[character_key] = rows

    output = {
        "meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "source_glob": args.glob_pattern,
            "total_runs": total_runs,
        },
        "overview": {
            "total_runs": total_runs,
            "total_wins": total_wins,
            "win_rate": round((total_wins / total_runs) * 100, 2) if total_runs else 0.0,
            "avg_run_minutes": round(
                sum((r["run_time_minutes"] or 0) for r in runs) / total_runs, 2
            ) if total_runs else 0.0,
            "avg_floor_reached": round(
                sum(r["floor_reached"] for r in runs) / total_runs, 2
            ) if total_runs else 0.0,
            "by_character": by_character,
            "by_ascension": by_ascension,
        },
        "winrate_over_time": winrate_over_time,
        "floor_stats": floor_stats,
        "room_type_stats": room_stats,
        "encounter_stats": encounter_stats,
        "encounter_stats_by_character": encounter_stats_by_character,
        "card_stats": finalize_presence_stats(card_presence),
        "card_stats_by_character": finalize_presence_stats_by_character(card_presence_by_character),
        "relic_stats": finalize_presence_stats(relic_presence),
        "relic_stats_by_character": finalize_presence_stats_by_character(relic_presence_by_character),
        "runs": runs,
    }

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Generated: {out_path.resolve()}")
    print(f"Runs: {total_runs} | Win rate: {output['overview']['win_rate']}%")


if __name__ == "__main__":
    main()
