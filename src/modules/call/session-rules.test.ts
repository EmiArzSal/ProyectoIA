import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { getSessionState, isUsableQuestion, lastAgentMessage, mapAnswersToPlan } from "./session-rules";
import { NO_ANSWER, TOTAL_QUESTIONS } from "./constants";

const AGENT = "agent";
const USER = "user";
type Item = { speaker_id: string; type: string; text: string; start_ts: number; stop_ts: number };
const turn = (speaker: string, text: string): Item => ({ speaker_id: speaker, type: "text", text, start_ts: 0, stop_ts: 0 });

/** Intro + n question/answer pairs; `skipped` answers are NO_ANSWER. */
function transcript(answers: number, skipped: number[] = []): Item[] {
  const items = [turn(AGENT, "intro + Q1")];
  for (let i = 1; i <= answers; i++) {
    items.push(turn(USER, skipped.includes(i) ? NO_ANSWER : `answer ${i}`));
    items.push(turn(AGENT, i === TOTAL_QUESTIONS ? "closing" : `Q${i + 1}`));
  }
  return items;
}

describe("getSessionState", () => {
  it("lets only the interviewer speak first", () => {
    const s = getSessionState([], AGENT);
    assert.equal(s.canAgentRespond, true);
    assert.equal(s.canUserAnswer, false);
  });

  it("alternates turns during the main round", () => {
    const afterQuestion = getSessionState(transcript(3), AGENT);
    assert.deepEqual([afterQuestion.canAgentRespond, afterQuestion.canUserAnswer], [false, true]);

    const afterAnswer = getSessionState([...transcript(3), turn(USER, "answer 4")], AGENT);
    assert.deepEqual([afterAnswer.canAgentRespond, afterAnswer.canUserAnswer], [true, false]);
  });

  it("ends after the closing message when nothing was skipped", () => {
    const s = getSessionState(transcript(TOTAL_QUESTIONS), AGENT);
    assert.deepEqual([s.canAgentRespond, s.canUserAnswer], [false, false]);
  });

  it("allows exactly one review answer per skipped question", () => {
    const base = transcript(TOTAL_QUESTIONS, [2, 5]);
    assert.equal(getSessionState(base, AGENT).canUserAnswer, true);
    const one = [...base, turn(USER, "late answer 2")];
    assert.equal(getSessionState(one, AGENT).canUserAnswer, true);
    assert.equal(getSessionState(one, AGENT).canAgentRespond, false);
    const two = [...one, turn(USER, "late answer 5")];
    assert.equal(getSessionState(two, AGENT).canUserAnswer, false);
  });

  it("rejects a second answer to the same question", () => {
    const s = getSessionState([...transcript(2), turn(USER, "answer 3")], AGENT);
    assert.equal(s.canUserAnswer, false);
  });
});

describe("lastAgentMessage", () => {
  it("returns the interviewer's latest message", () => {
    assert.equal(lastAgentMessage(transcript(2), AGENT), "Q3");
    assert.equal(lastAgentMessage([], AGENT), undefined);
  });
});

describe("mapAnswersToPlan", () => {
  it("maps answers to positions and fills skipped ones from the review round", () => {
    const items = [
      ...transcript(TOTAL_QUESTIONS, [2, 5]),
      turn(USER, "late answer 2"),
      turn(USER, NO_ANSWER), // skipped again in the review
    ];
    const map = mapAnswersToPlan(items, AGENT, TOTAL_QUESTIONS);
    assert.equal(map.size, TOTAL_QUESTIONS);
    assert.equal(map.get(1), "answer 1");
    assert.equal(map.get(2), "late answer 2");
    assert.equal(map.get(5), NO_ANSWER);
  });

  it("marks questions never reached as unanswered", () => {
    const map = mapAnswersToPlan(transcript(3), AGENT, TOTAL_QUESTIONS);
    assert.equal(map.get(3), "answer 3");
    assert.equal(map.get(4), NO_ANSWER);
    assert.equal(map.get(10), NO_ANSWER);
  });
});

describe("isUsableQuestion", () => {
  it("accepts one spoken question", () => {
    assert.ok(isUsableQuestion("What is DNS?"));
  });

  it("accepts behavioral statements only for soft skills", () => {
    const prompt = "Tell me about a time you worked in a team.";
    assert.ok(isUsableQuestion(prompt, [], "soft"));
    assert.ok(!isUsableQuestion(prompt, [], "technical"));
  });

  it("rejects too short, several questions, code-like text and repeats", () => {
    assert.ok(!isUsableQuestion("Why?"));
    assert.ok(!isUsableQuestion("What is React? And what is Vue?"));
    assert.ok(!isUsableQuestion("What does const x = {a: 1}; do?"));
    assert.ok(!isUsableQuestion("What is DNS?", ["what is dns"]));
  });
});
