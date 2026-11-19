import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { isInstitutionalEmail } from "./institutional-email";

describe("isInstitutionalEmail", () => {
  it("accepts student addresses in any letter case", () => {
    assert.equal(isInstitutionalEmail("jperez2001@alumno.ipn.mx"), true);
    assert.equal(isInstitutionalEmail("  JPerez@Alumno.IPN.mx "), true);
  });

  it("rejects other domains", () => {
    assert.equal(isInstitutionalEmail("someone@gmail.com"), false);
    assert.equal(isInstitutionalEmail("profe@ipn.mx"), false);
  });

  it("rejects look-alike domains", () => {
    assert.equal(isInstitutionalEmail("a@evil.alumno.ipn.mx"), false);
    assert.equal(isInstitutionalEmail("a@alumno.ipn.mx.evil.com"), false);
    assert.equal(isInstitutionalEmail("a@alumno-ipn.mx"), false);
  });

  it("rejects malformed addresses", () => {
    assert.equal(isInstitutionalEmail("@alumno.ipn.mx"), false);
    assert.equal(isInstitutionalEmail("a@b@alumno.ipn.mx"), false);
    assert.equal(isInstitutionalEmail("alumno.ipn.mx"), false);
    assert.equal(isInstitutionalEmail(""), false);
  });
});
