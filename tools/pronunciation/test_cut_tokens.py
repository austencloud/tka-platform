# tools/pronunciation/test_cut_tokens.py
"""Run: conda activate tka-pronunciation && python -m pytest tools/pronunciation"""

import pathlib

from cut_tokens import spans_from_textgrid, token_records

FIXTURE = pathlib.Path(__file__).parents[2] / "tests/fixtures/pronunciation/sample.TextGrid"


def test_reads_word_spans_and_drops_the_silences():
    spans = spans_from_textgrid(FIXTURE)

    assert spans == [("Alpha", 0.25, 0.70), ("Sigma dash", 0.70, 1.20)]


def test_assigns_position_and_neighbours_from_order():
    # position and neighbour-nullness encode the same fact, and
    # hasCoherentContext rejects a token where they disagree — so a token whose
    # position says initial while carrying a previous letter never loads.
    records = token_records("001", ["α", "Σ-"], spans_from_textgrid(FIXTURE))

    assert records[0]["position"] == "initial"
    assert records[0]["previousLetter"] is None
    assert records[0]["nextLetter"] == "Σ-"
    assert records[1]["position"] == "final"
    assert records[1]["previousLetter"] == "α"
    assert records[1]["nextLetter"] is None
    assert all(record["groupLength"] == 2 for record in records)


def test_marks_a_single_letter_read_isolated():
    records = token_records("002", ["α"], [("Alpha", 0.25, 0.70)])

    assert records[0]["position"] == "isolated"
    assert records[0]["previousLetter"] is None
    assert records[0]["nextLetter"] is None


def test_refuses_a_grid_that_does_not_match_the_word():
    # Forcing two letters onto three aligned spans would file every token under
    # the wrong neighbours, and nothing downstream would notice.
    try:
        token_records("003", ["α"], spans_from_textgrid(FIXTURE))
    except ValueError:
        return
    raise AssertionError("expected a ValueError")
