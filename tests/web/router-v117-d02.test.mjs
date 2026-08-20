import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyQuestion
} from "../../core/ai/router.mjs";

test(
  '117-D02 acepta "¿cuántos grados hay?" como estructura masónica',
  () => {
    assert.deepEqual(
      classifyQuestion("¿cuántos grados hay?"),
      {
        inScope: true,
        topic: "estructura"
      }
    );
  }
);

test(
  "117-D02 acepta variantes naturales sobre grados",
  () => {
    const preguntas = [
      "¿Cuáles son los grados?",
      "¿Qué grados hay?",
      "¿Cuántos grados existen?",
      "¿Cuántos grados tiene la Masonería?"
    ];

    for (const pregunta of preguntas) {
      const result =
        classifyQuestion(pregunta);

      assert.equal(
        result.inScope,
        true,
        pregunta
      );

      assert.equal(
        result.topic,
        "estructura",
        pregunta
      );
    }
  }
);

test(
  "117-D02 mantiene fuera de alcance grados de temperatura",
  () => {
    const preguntas = [
      "¿Cuántos grados hace hoy?",
      "¿A cuántos grados está el horno?",
      "¿Cuántos grados Celsius hay?",
      "¿Cuántos grados de temperatura hay?"
    ];

    for (const pregunta of preguntas) {
      const result =
        classifyQuestion(pregunta);

      assert.equal(
        result.inScope,
        false,
        pregunta
      );

      assert.equal(
        result.topic,
        "fuera_de_tema",
        pregunta
      );
    }
  }
);

test(
  "117-D02 conserva otras consultas estructurales masónicas",
  () => {
    const preguntas = [
      "¿Qué es un rito masónico?",
      "¿Qué función tiene una Gran Logia?",
      "¿Qué es una obediencia masónica?"
    ];

    for (const pregunta of preguntas) {
      const result =
        classifyQuestion(pregunta);

      assert.equal(
        result.inScope,
        true,
        pregunta
      );
    }
  }
);

test(
  "117-D02 no convierte preguntas generales ajenas en masónicas",
  () => {
    const preguntas = [
      "¿Cómo hacer una pizza?",
      "¿Cuál es el clima de hoy?",
      "¿Cómo invertir dinero?"
    ];

    for (const pregunta of preguntas) {
      assert.equal(
        classifyQuestion(pregunta).inScope,
        false,
        pregunta
      );
    }
  }
);