import { describe, it, expect, beforeEach } from "vitest";
import { stringAsciiCV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_NOT_REGISTERED = 101;
const ERR_INVALID_SERVICE_ID = 102;
const ERR_INVALID_FEEDBACK = 103;
const ERR_INVALID_CATEGORY = 114;
const ERR_INVALID_PRIORITY = 115;
const ERR_INVALID_LOCATION = 116;
const ERR_INVALID_LANGUAGE = 117;
const ERR_INVALID_ANONYMITY_LEVEL = 118;
const ERR_MAX_SUBMISSIONS_EXCEEDED = 113;
const ERR_INVALID_RATE_LIMIT = 107;
const ERR_AUTHORITY_NOT_VERIFIED = 109;
const ERR_SUBMISSION_ALREADY_EXISTS = 105;
const ERR_SUBMISSION_NOT_FOUND = 106;
const ERR_INVALID_STATUS = 108;
const ERR_INVALID_VERIFICATION_STATUS = 119;

interface Submission {
  serviceId: number;
  feedback: string;
  submitter: string;
  timestamp: number;
  category: string;
  priority: number;
  location: string;
  language: string;
  anonymityLevel: number;
  status: boolean;
  verificationStatus: boolean;
}

interface SubmissionUpdate {
  updateFeedback: string;
  updateTimestamp: number;
  updater: string;
  updateCategory: string;
  updatePriority: number;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class FeedbackSubmissionMock {
  state: {
    nextSubmissionId: number;
    maxSubmissions: number;
    submissionFee: number;
    authorityContract: string | null;
    rateLimitPerUser: number;
    minFeedbackLength: number;
    maxFeedbackLength: number;
    submissions: Map<number, Submission>;
    submissionUpdates: Map<number, SubmissionUpdate>;
    submissionsBySubmitter: Map<string, number[]>;
    submissionCountByUser: Map<string, number>;
  } = {
    nextSubmissionId: 1,
    maxSubmissions: 10000,
    submissionFee: 10,
    authorityContract: null,
    rateLimitPerUser: 5,
    minFeedbackLength: 10,
    maxFeedbackLength: 1000,
    submissions: new Map(),
    submissionUpdates: new Map(),
    submissionsBySubmitter: new Map(),
    submissionCountByUser: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  registeredUsers: Set<string> = new Set(["ST1TEST"]);
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextSubmissionId: 1,
      maxSubmissions: 10000,
      submissionFee: 10,
      authorityContract: null,
      rateLimitPerUser: 5,
      minFeedbackLength: 10,
      maxFeedbackLength: 1000,
      submissions: new Map(),
      submissionUpdates: new Map(),
      submissionsBySubmitter: new Map(),
      submissionCountByUser: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.registeredUsers = new Set(["ST1TEST"]);
    this.stxTransfers = [];
  }

  isRegistered(user: string): Result<boolean> {
    return { ok: true, value: this.registeredUsers.has(user) };
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setSubmissionFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.submissionFee = newFee;
    return { ok: true, value: true };
  }

  setRateLimitPerUser(newLimit: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    if (newLimit <= 0) return { ok: false, value: false };
    this.state.rateLimitPerUser = newLimit;
    return { ok: true, value: true };
  }

  setMinFeedbackLength(newMin: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    if (newMin <= 0) return { ok: false, value: false };
    this.state.minFeedbackLength = newMin;
    return { ok: true, value: true };
  }

  setMaxFeedbackLength(newMax: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    if (newMax <= this.state.minFeedbackLength) return { ok: false, value: false };
    this.state.maxFeedbackLength = newMax;
    return { ok: true, value: true };
  }

  submitFeedback(
    serviceId: number,
    feedback: string,
    category: string,
    priority: number,
    location: string,
    language: string,
    anonymityLevel: number
  ): Result<number> {
    if (!this.isRegistered(this.caller).value) return { ok: false, value: ERR_NOT_REGISTERED };
    if (this.state.nextSubmissionId >= this.state.maxSubmissions) return { ok: false, value: ERR_MAX_SUBMISSIONS_EXCEEDED };
    const userCount = this.state.submissionCountByUser.get(this.caller) || 0;
    if (userCount >= this.state.rateLimitPerUser) return { ok: false, value: ERR_INVALID_RATE_LIMIT };
    if (serviceId <= 0) return { ok: false, value: ERR_INVALID_SERVICE_ID };
    if (feedback.length < this.state.minFeedbackLength || feedback.length > this.state.maxFeedbackLength) return { ok: false, value: ERR_INVALID_FEEDBACK };
    if (!["service-quality", "access", "efficiency"].includes(category)) return { ok: false, value: ERR_INVALID_CATEGORY };
    if (priority < 1 || priority > 5) return { ok: false, value: ERR_INVALID_PRIORITY };
    if (!location || location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (!["english", "arabic", "french"].includes(language)) return { ok: false, value: ERR_INVALID_LANGUAGE };
    if (anonymityLevel < 1 || anonymityLevel > 3) return { ok: false, value: ERR_INVALID_ANONYMITY_LEVEL };
    if (this.state.submissions.has(this.state.nextSubmissionId)) return { ok: false, value: ERR_SUBMISSION_ALREADY_EXISTS };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.submissionFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextSubmissionId;
    const submission: Submission = {
      serviceId,
      feedback,
      submitter: this.caller,
      timestamp: this.blockHeight,
      category,
      priority,
      location,
      language,
      anonymityLevel,
      status: true,
      verificationStatus: false,
    };
    this.state.submissions.set(id, submission);
    const userSubs = this.state.submissionsBySubmitter.get(this.caller) || [];
    this.state.submissionsBySubmitter.set(this.caller, [...userSubs, id]);
    this.state.submissionCountByUser.set(this.caller, userCount + 1);
    this.state.nextSubmissionId++;
    return { ok: true, value: id };
  }

  getSubmission(id: number): Submission | null {
    return this.state.submissions.get(id) || null;
  }

  updateSubmission(id: number, updateFeedback: string, updateCategory: string, updatePriority: number): Result<boolean> {
    const submission = this.state.submissions.get(id);
    if (!submission) return { ok: false, value: false };
    if (submission.submitter !== this.caller) return { ok: false, value: false };
    if (updateFeedback.length < this.state.minFeedbackLength || updateFeedback.length > this.state.maxFeedbackLength) return { ok: false, value: false };
    if (!["service-quality", "access", "efficiency"].includes(updateCategory)) return { ok: false, value: false };
    if (updatePriority < 1 || updatePriority > 5) return { ok: false, value: false };

    const updated: Submission = {
      ...submission,
      feedback: updateFeedback,
      timestamp: this.blockHeight,
      category: updateCategory,
      priority: updatePriority,
    };
    this.state.submissions.set(id, updated);
    this.state.submissionUpdates.set(id, {
      updateFeedback,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
      updateCategory,
      updatePriority,
    });
    return { ok: true, value: true };
  }

  verifySubmission(id: number): Result<boolean> {
    const submission = this.state.submissions.get(id);
    if (!submission) return { ok: false, value: false };
    if (!this.state.authorityContract) return { ok: false, value: false };
    if (submission.verificationStatus) return { ok: false, value: false };
    this.state.submissions.set(id, { ...submission, verificationStatus: true });
    return { ok: true, value: true };
  }

  deactivateSubmission(id: number): Result<boolean> {
    const submission = this.state.submissions.get(id);
    if (!submission) return { ok: false, value: false };
    if (submission.submitter !== this.caller) return { ok: false, value: false };
    if (!submission.status) return { ok: false, value: false };
    this.state.submissions.set(id, { ...submission, status: false });
    return { ok: true, value: true };
  }

  getSubmissionCount(): Result<number> {
    return { ok: true, value: this.state.nextSubmissionId };
  }

  checkSubmissionExistence(id: number): Result<boolean> {
    return { ok: true, value: this.state.submissions.has(id) };
  }
}

describe("FeedbackSubmission", () => {
  let contract: FeedbackSubmissionMock;

  beforeEach(() => {
    contract = new FeedbackSubmissionMock();
    contract.reset();
  });

  it("submits feedback successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.submitFeedback(
      1,
      "This is good feedback",
      "service-quality",
      3,
      "Camp A",
      "english",
      2
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(1);

    const submission = contract.getSubmission(1);
    expect(submission?.serviceId).toBe(1);
    expect(submission?.feedback).toBe("This is good feedback");
    expect(submission?.category).toBe("service-quality");
    expect(submission?.priority).toBe(3);
    expect(submission?.location).toBe("Camp A");
    expect(submission?.language).toBe("english");
    expect(submission?.anonymityLevel).toBe(2);
    expect(contract.stxTransfers).toEqual([{ amount: 10, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects submission with invalid feedback length", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.submitFeedback(
      1,
      "Short",
      "service-quality",
      3,
      "Camp A",
      "english",
      2
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_FEEDBACK);
  });

  it("rejects non-registered user", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.caller = "ST2FAKE";
    contract.registeredUsers = new Set();
    const result = contract.submitFeedback(
      1,
      "This is good feedback",
      "service-quality",
      3,
      "Camp A",
      "english",
      2
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_REGISTERED);
  });

  it("rejects submission without authority contract", () => {
    const result = contract.submitFeedback(
      1,
      "This is good feedback",
      "service-quality",
      3,
      "Camp A",
      "english",
      2
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects invalid category", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.submitFeedback(
      1,
      "This is good feedback",
      "invalid",
      3,
      "Camp A",
      "english",
      2
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_CATEGORY);
  });

  it("updates submission successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.submitFeedback(
      1,
      "Old feedback",
      "service-quality",
      3,
      "Camp A",
      "english",
      2
    );
    const result = contract.updateSubmission(1, "New feedback", "access", 4);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const submission = contract.getSubmission(1);
    expect(submission?.feedback).toBe("New feedback");
    expect(submission?.category).toBe("access");
    expect(submission?.priority).toBe(4);
    const update = contract.state.submissionUpdates.get(1);
    expect(update?.updateFeedback).toBe("New feedback");
    expect(update?.updateCategory).toBe("access");
    expect(update?.updatePriority).toBe(4);
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update for non-existent submission", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.updateSubmission(99, "New feedback", "access", 4);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects update by non-submitter", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.submitFeedback(
      1,
      "This is good feedback",
      "service-quality",
      3,
      "Camp A",
      "english",
      2
    );
    contract.caller = "ST3FAKE";
    const result = contract.updateSubmission(1, "New feedback", "access", 4);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("sets submission fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setSubmissionFee(20);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.submissionFee).toBe(20);
    contract.submitFeedback(
      1,
      "This is good feedback",
      "service-quality",
      3,
      "Camp A",
      "english",
      2
    );
    expect(contract.stxTransfers).toEqual([{ amount: 20, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects submission fee change without authority contract", () => {
    const result = contract.setSubmissionFee(20);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("checks submission existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.submitFeedback(
      1,
      "This is good feedback",
      "service-quality",
      3,
      "Camp A",
      "english",
      2
    );
    const result = contract.checkSubmissionExistence(1);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const result2 = contract.checkSubmissionExistence(99);
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("parses submission parameters with Clarity types", () => {
    const feedback = stringAsciiCV("Test feedback");
    const serviceId = uintCV(1);
    expect(feedback.value).toBe("Test feedback");
    expect(serviceId.value).toEqual(BigInt(1));
  });

  it("rejects submission with empty feedback", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.submitFeedback(
      1,
      "",
      "service-quality",
      3,
      "Camp A",
      "english",
      2
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_FEEDBACK);
  });

  it("rejects submission with max submissions exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxSubmissions = 1;
    contract.submitFeedback(
      1,
      "Feedback1",
      "service-quality",
      3,
      "Camp A",
      "english",
      2
    );
    const result = contract.submitFeedback(
      2,
      "Feedback2",
      "access",
      4,
      "Camp B",
      "arabic",
      1
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_SUBMISSIONS_EXCEEDED);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("verifies submission successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.submitFeedback(
      1,
      "This is good feedback",
      "service-quality",
      3,
      "Camp A",
      "english",
      2
    );
    const result = contract.verifySubmission(1);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const submission = contract.getSubmission(1);
    expect(submission?.verificationStatus).toBe(true);
  });

  it("rejects verification without authority", () => {
    contract.submitFeedback(
      1,
      "This is good feedback",
      "service-quality",
      3,
      "Camp A",
      "english",
      2
    );
    const result = contract.verifySubmission(1);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("deactivates submission successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.submitFeedback(
      1,
      "This is good feedback",
      "service-quality",
      3,
      "Camp A",
      "english",
      2
    );
    const result = contract.deactivateSubmission(1);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const submission = contract.getSubmission(1);
    expect(submission?.status).toBe(false);
  });

  it("rejects deactivation by non-submitter", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.submitFeedback(
      1,
      "This is good feedback",
      "service-quality",
      3,
      "Camp A",
      "english",
      2
    );
    contract.caller = "ST3FAKE";
    const result = contract.deactivateSubmission(1);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});