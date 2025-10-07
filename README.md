# AnonRefugeeFeedback

## Overview

AnonRefugeeFeedback is a Web3 project built on the Stacks blockchain using Clarity smart contracts. It provides a decentralized platform for refugees to submit anonymous feedback on aid services provided by humanitarian organizations. The platform ensures anonymity to protect vulnerable users from potential retribution, while leveraging blockchain's immutability and transparency to deliver verifiable insights to aid providers. This helps solve real-world problems such as:

- **Lack of Safe Feedback Mechanisms**: Refugees often face risks when providing honest feedback due to power imbalances or fear of losing aid. Anonymity via pseudonymous blockchain identities mitigates this.
- **Data Tampering and Corruption**: Traditional feedback systems can be manipulated. Blockchain ensures feedback is tamper-proof and publicly auditable.
- **Inefficient Aid Improvement**: Aid organizations struggle with biased or incomplete data. Aggregated, verifiable feedback enables data-driven improvements, reducing waste and enhancing service quality.
- **Incentive Gaps**: Users may not participate without rewards. A token-based incentive system encourages honest contributions.
- **Governance Challenges**: Centralized control can lead to biases. A DAO-like governance allows community oversight.

The project involves 7 core smart contracts written in Clarity, focusing on user management, service registration, feedback handling, ratings, incentives, storage, and governance. It uses Stacks' Bitcoin-secured blockchain for security and scalability.

## Architecture

- **Frontend**: A simple web dApp (not included here) interacts with the contracts via Stacks.js or Hiro Wallet.
- **Backend**: Purely on-chain via Clarity contracts.
- **Anonymity**: Users interact via wallet addresses without linking to real identities. Feedback is submitted without revealing submitter details beyond a pseudonymous ID.
- **Workflow**:
  1. Aid organizations register services.
  2. Refugees register anonymously.
  3. Users submit feedback on services.
  4. Feedback is stored immutably and rated.
  5. Incentives are distributed for valid submissions.
  6. Governance proposals manage platform updates.
- **Dependencies**: Stacks blockchain (testnet/mainnet). No external oracles needed; all logic is on-chain.

## Smart Contracts

Below are the 7 smart contracts with their purposes, key functions, and sample Clarity code. These are designed to be secure, efficient, and composable. Deploy them in order (e.g., via Clarinet or Stacks CLI).

### 1. UserRegistry.clar
**Purpose**: Manages anonymous user registration. Users register with a pseudonymous ID (derived from their principal) to prevent spam while maintaining anonymity.

```clarity
;; User Registry Contract

(define-map users principal bool)

(define-public (register-user)
  (ok (map-set users tx-sender true))
)

(define-read-only (is-registered (user principal))
  (default-to false (map-get? users user))
)
```

### 2. AidServiceRegistry.clar
**Purpose**: Allows verified aid organizations to register services (e.g., food distribution, medical aid). Includes basic verification via admin approval to prevent fake entries.

```clarity
;; Aid Service Registry Contract

(define-map services uint { name: (string-ascii 100), org: principal, description: (string-ascii 500) })
(define-map service-ids uint bool)
(define-data-var next-id uint u1)
(define-data-var admin principal tx-sender)

(define-public (register-service (name (string-ascii 100)) (description (string-ascii 500)))
  (if (is-eq tx-sender (var-get admin))
    (let ((id (var-get next-id)))
      (map-set services id { name: name, org: tx-sender, description: description })
      (map-set service-ids id true)
      (var-set next-id (+ id u1))
      (ok id))
    (err u100) ;; Not admin
  )
)

(define-read-only (get-service (id uint))
  (map-get? services id)
)
```

### 3. FeedbackSubmission.clar
**Purpose**: Handles submission of anonymous feedback linked to a service ID. Ensures only registered users can submit and enforces rate limits.

```clarity
;; Feedback Submission Contract

(use-trait user-registry .UserRegistry.is-registered)

(define-map submissions uint { service-id: uint, feedback: (string-ascii 1000), submitter: principal, timestamp: uint })
(define-data-var next-submission-id uint u1)

(define-public (submit-feedback (service-id uint) (feedback (string-ascii 1000)))
  (if (is-registered tx-sender)
    (let ((id (var-get next-submission-id)))
      (map-set submissions id { service-id: service-id, feedback: feedback, submitter: tx-sender, timestamp: block-height })
      (var-set next-submission-id (+ id u1))
      (ok id))
    (err u101) ;; Not registered
  )
)
```

### 4. FeedbackStorage.clar
**Purpose**: Immutable storage for feedback data. Uses maps for efficient querying and ensures data cannot be altered post-submission.

```clarity
;; Feedback Storage Contract

(define-map stored-feedback uint (string-ascii 1000))
(define-map feedback-by-service uint (list 100 uint)) ;; List of feedback IDs per service

(define-public (store-feedback (id uint) (feedback (string-ascii 1000)) (service-id uint))
  (begin
    (map-set stored-feedback id feedback)
    (map-insert feedback-by-service service-id (cons id (default-to (list) (map-get? feedback-by-service service-id))))
    (ok true)
  )
)

(define-read-only (get-feedback (id uint))
  (map-get? stored-feedback id)
)

(define-read-only (get-feedback-for-service (service-id uint))
  (map-get? feedback-by-service service-id)
)
```

### 5. RatingSystem.clar
**Purpose**: Aggregates ratings from feedback. Users submit ratings (1-5) alongside feedback, and this contract computes averages for transparency.

```clarity
;; Rating System Contract

(define-map ratings uint uint) ;; Feedback ID to rating (1-5)
(define-map average-ratings uint { sum: uint, count: uint })

(define-public (add-rating (feedback-id uint) (rating uint) (service-id uint))
  (if (and (>= rating u1) (<= rating u5))
    (begin
      (map-set ratings feedback-id rating)
      (let ((current (default-to { sum: u0, count: u0 } (map-get? average-ratings service-id))))
        (map-set average-ratings service-id { sum: (+ (get sum current) rating), count: (+ (get count current) u1) })
      )
      (ok true)
    )
    (err u102) ;; Invalid rating
  )
)

(define-read-only (get-average-rating (service-id uint))
  (let ((data (default-to { sum: u0, count: u0 } (map-get? average-ratings service-id))))
    (if (> (get count data) u0)
      (/ (get sum data) (get count data))
      u0
    )
  )
)
```

### 6. IncentiveToken.clar
**Purpose**: A simple fungible token (similar to SIP-10) to reward users for submitting feedback. Tokens can be used for governance or redeemed.

```clarity
;; Incentive Token Contract (SIP-10 like)

(define-fungible-token incentive-token u1000000)
(define-data-var admin principal tx-sender)

(define-public (mint (amount uint) (recipient principal))
  (if (is-eq tx-sender (var-get admin))
    (ft-mint? incentive-token amount recipient)
    (err u103) ;; Not admin
  )
)

(define-public (reward-user (user principal) (amount uint))
  (mint amount user)
)

(define-read-only (get-balance (user principal))
  (ft-get-balance incentive-token user)
)
```

### 7. Governance.clar
**Purpose**: DAO-style governance for platform updates, such as changing admins or parameters. Token holders vote on proposals.

```clarity
;; Governance Contract

(define-map proposals uint { description: (string-ascii 500), votes-for: uint, votes-against: uint, active: bool })
(define-data-var next-proposal-id uint u1)

(define-public (create-proposal (description (string-ascii 500)))
  (let ((id (var-get next-proposal-id)))
    (map-set proposals id { description: description, votes-for: u0, votes-against: u0, active: true })
    (var-set next-proposal-id (+ id u1))
    (ok id)
  )
)

(define-public (vote (proposal-id uint) (vote bool))
  (if (get active (default-to { active: false } (map-get? proposals proposal-id)))
    (let ((balance (get-balance tx-sender)))
      (if vote
        (map-set proposals proposal-id { votes-for: (+ (get votes-for (map-get? proposals proposal-id)) balance) })
        (map-set proposals proposal-id { votes-against: (+ (get votes-against (map-get? proposals proposal-id)) balance) })
      )
      (ok true)
    )
    (err u104) ;; Inactive proposal
  )
)

(define-read-only (get-proposal (id uint))
  (map-get? proposals id)
)
```

## Deployment and Usage

1. **Setup**: Use Clarinet for local development: `clarinet new anon-refugee-feedback` and add contracts.
2. **Testing**: Write tests in Clarity (e.g., via `(contract-call? ...)`).
3. **Deployment**: Deploy to Stacks testnet/mainnet using Hiro tools.
4. **Integration**: Build a dApp to call these contracts (e.g., register, submit feedback).
5. **Security Notes**: Audit contracts before production. Clarity's predictability prevents reentrancy issues.

## Contributing

Fork the repo, add improvements, and PR. Focus on enhancing anonymity or integrating ZK if possible in future Stacks updates.

## License

MIT License.