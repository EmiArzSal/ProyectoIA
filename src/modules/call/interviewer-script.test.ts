import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";

import { PREDEFINED_AGENTS } from "@/lib/predefined-agents";
import { TECH_QUESTIONS, TOTAL_QUESTIONS } from "./constants";
import {
  BEHAVIORAL_TRANSITION,
  CLOSING_AUDIO_URL,
  CLOSING_TEXT,
  ackFromMessage,
  canSpeakQuestion,
  composeMessage,
  introAudioUrl,
  introText,
  joinClips,
  messageClips,
  questionSpeech,
} from "./interviewer-script";

const agent = { id: "ag_test", interviewerName: "Alex", role: "Frontend Developer" };
const questions = Array.from({ length: TOTAL_QUESTIONS }, (_, i) => `Question number ${i + 1}?`);

describe("composeMessage", () => {
  // Same text the interviewer produced before the message was split in clips,
  // so interviews and reports keep the same transcript.
  it("keeps the intro format", () => {
    assert.equal(
      composeMessage(0, agent, questions, "ignored"),
      "Hi, I'm Alex, and I'll be your interviewer for this Frontend Developer position. " +
        "I'll ask you 6 technical questions and then 4 behavioral questions. Let's begin. Question number 1?",
    );
  });

  it("keeps the middle and transition format", () => {
    assert.equal(composeMessage(3, agent, questions, "Thanks."), "Thanks. Question number 4?");
    assert.equal(
      composeMessage(TECH_QUESTIONS, agent, questions, "Got it."),
      `Got it. ${BEHAVIORAL_TRANSITION} Question number 7?`,
    );
  });

  it("keeps the closing format", () => {
    assert.equal(composeMessage(TOTAL_QUESTIONS, agent, questions, "Okay, thank you."), `Okay, thank you. ${CLOSING_TEXT}`);
  });

  it("is spoken as intro + question clips", () => {
    assert.equal(composeMessage(0, agent, questions, ""), `${introText(agent)} ${questionSpeech(questions[0], 0)}`);
  });
});

describe("ackFromMessage", () => {
  it("recovers the ack of every turn", () => {
    for (let answered = 1; answered <= TOTAL_QUESTIONS; answered++) {
      const ack = `Thanks for answer ${answered}.`;
      assert.equal(ackFromMessage(composeMessage(answered, agent, questions, ack), answered, questions), ack, `turn ${answered}`);
    }
  });

  it("handles an ack that repeats words of the question", () => {
    const ack = "Question number 4 was answered clearly.";
    assert.equal(ackFromMessage(composeMessage(3, agent, questions, ack), 3, questions), ack);
  });

  it("returns null for the intro and for unexpected messages", () => {
    assert.equal(ackFromMessage(composeMessage(0, agent, questions, ""), 0, questions), null);
    assert.equal(ackFromMessage("Thanks. A different question?", 3, questions), null);
    // Right tail, but composed for another turn.
    assert.equal(ackFromMessage(composeMessage(3, agent, questions, "Thanks."), 4, questions), null);
    // Nothing before the tail.
    assert.equal(ackFromMessage(` ${questions[3]}`, 3, questions), null);
  });
});

describe("messageClips", () => {
  const kinds = (answered: number) =>
    messageClips(answered, agent, questions, "Thanks.").map((c) =>
      c.kind === "question" ? { kind: c.kind, index: c.index } : { kind: c.kind });

  it("plays the greeting and question 1 first", () => {
    assert.deepEqual(kinds(0), [{ kind: "intro" }, { kind: "question", index: 0 }]);
  });

  it("plays the ack and the next question in the middle", () => {
    assert.deepEqual(kinds(1), [{ kind: "ack" }, { kind: "question", index: 1 }]);
    assert.deepEqual(kinds(TOTAL_QUESTIONS - 1), [{ kind: "ack" }, { kind: "question", index: TOTAL_QUESTIONS - 1 }]);
  });

  it("plays the ack and the closing at the end", () => {
    assert.deepEqual(kinds(TOTAL_QUESTIONS), [{ kind: "ack" }, { kind: "closing" }]);
  });

  it("carries the words each clip says, which add up to the stored message", () => {
    for (let answered = 0; answered <= TOTAL_QUESTIONS; answered++) {
      const clips = messageClips(answered, agent, questions, "Thanks.");
      assert.equal(joinClips(clips), composeMessage(answered, agent, questions, "Thanks."));
    }
    assert.deepEqual(messageClips(0, agent, questions, "").map((c) => c.text), [introText(agent), questions[0]]);
  });

  it("includes the behavioral transition in question 7's clip", () => {
    assert.equal(questionSpeech("Tell me about a project.", TECH_QUESTIONS), `${BEHAVIORAL_TRANSITION} Tell me about a project.`);
    assert.equal(questionSpeech("What is a closure?", TECH_QUESTIONS - 1), "What is a closure?");
  });
});

describe("canSpeakQuestion", () => {
  it("allows the current question and the next one only", () => {
    assert.equal(canSpeakQuestion(0, 0), true);
    assert.equal(canSpeakQuestion(1, 0), true);
    assert.equal(canSpeakQuestion(2, 0), false);
    assert.equal(canSpeakQuestion(5, 4), true);
    assert.equal(canSpeakQuestion(6, 4), false);
  });

  it("rejects indexes outside the plan", () => {
    assert.equal(canSpeakQuestion(-1, 3), false);
    assert.equal(canSpeakQuestion(TOTAL_QUESTIONS, TOTAL_QUESTIONS), false);
    assert.equal(canSpeakQuestion(1.5, 3), false);
  });
});

describe("pre-recorded interviewer audio", () => {
  const file = (url: string) => path.join(process.cwd(), "public", url);

  it("exists for every interviewer and for the closing (npm run audio:interviewer)", () => {
    for (const a of PREDEFINED_AGENTS) {
      assert.ok(existsSync(file(introAudioUrl(a.id))), `missing ${introAudioUrl(a.id)}`);
    }
    assert.ok(existsSync(file(CLOSING_AUDIO_URL)), `missing ${CLOSING_AUDIO_URL}`);
  });
});
