(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-NOT-REGISTERED u101)
(define-constant ERR-INVALID-SERVICE-ID u102)
(define-constant ERR-INVALID-FEEDBACK u103)
(define-constant ERR-INVALID-TIMESTAMP u104)
(define-constant ERR-SUBMISSION-ALREADY-EXISTS u105)
(define-constant ERR-SUBMISSION-NOT-FOUND u106)
(define-constant ERR-INVALID-RATE-LIMIT u107)
(define-constant ERR-INVALID-STATUS u108)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u109)
(define-constant ERR-INVALID-MAX-SUBMISSIONS u110)
(define-constant ERR-INVALID-MIN-FEEDBACK-LENGTH u111)
(define-constant ERR-INVALID-MAX-FEEDBACK-LENGTH u112)
(define-constant ERR-MAX-SUBMISSIONS-EXCEEDED u113)
(define-constant ERR-INVALID-CATEGORY u114)
(define-constant ERR-INVALID-PRIORITY u115)
(define-constant ERR-INVALID-LOCATION u116)
(define-constant ERR-INVALID-LANGUAGE u117)
(define-constant ERR-INVALID-ANONYMITY-LEVEL u118)
(define-constant ERR-INVALID-VERIFICATION-STATUS u119)
(define-constant ERR-INVALID-UPDATE-PARAM u120)

(define-data-var next-submission-id uint u1)
(define-data-var max-submissions uint u10000)
(define-data-var submission-fee uint u10)
(define-data-var authority-contract (optional principal) none)
(define-data-var rate-limit-per-user uint u5)
(define-data-var min-feedback-length uint u10)
(define-data-var max-feedback-length uint u1000)

(define-map submissions
  uint
  {
    service-id: uint,
    feedback: (string-ascii 1000),
    submitter: principal,
    timestamp: uint,
    category: (string-ascii 50),
    priority: uint,
    location: (string-ascii 100),
    language: (string-ascii 20),
    anonymity-level: uint,
    status: bool,
    verification-status: bool
  }
)

(define-map submissions-by-submitter
  principal
  (list 100 uint))

(define-map submission-updates
  uint
  {
    update-feedback: (string-ascii 1000),
    update-timestamp: uint,
    updater: principal,
    update-category: (string-ascii 50),
    update-priority: uint
  }
)

(define-map submission-count-by-user
  principal
  uint)

(define-read-only (get-submission (id uint))
  (map-get? submissions id)
)

(define-read-only (get-submission-updates (id uint))
  (map-get? submission-updates id)
)

(define-read-only (get-submissions-by-submitter (submitter principal))
  (default-to (list) (map-get? submissions-by-submitter submitter))
)

(define-read-only (is-submission-registered (id uint))
  (is-some (map-get? submissions id))
)

(define-private (validate-service-id (service-id uint))
  (if (> service-id u0)
      (ok true)
      (err ERR-INVALID-SERVICE-ID))
)

(define-private (validate-feedback (feedback (string-ascii 1000)))
  (let ((len (len feedback)))
    (if (and (>= len (var-get min-feedback-length)) (<= len (var-get max-feedback-length)))
        (ok true)
        (err ERR-INVALID-FEEDBACK))
  )
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-category (category (string-ascii 50)))
  (if (or (is-eq category "service-quality") (is-eq category "access") (is-eq category "efficiency"))
      (ok true)
      (err ERR-INVALID-CATEGORY))
)

(define-private (validate-priority (priority uint))
  (if (and (>= priority u1) (<= priority u5))
      (ok true)
      (err ERR-INVALID-PRIORITY))
)

(define-private (validate-location (loc (string-ascii 100)))
  (if (and (> (len loc) u0) (<= (len loc) u100))
      (ok true)
      (err ERR-INVALID-LOCATION))
)

(define-private (validate-language (lang (string-ascii 20)))
  (if (or (is-eq lang "english") (is-eq lang "arabic") (is-eq lang "french"))
      (ok true)
      (err ERR-INVALID-LANGUAGE))
)

(define-private (validate-anonymity-level (level uint))
  (if (and (>= level u1) (<= level u3))
      (ok true)
      (err ERR-INVALID-ANONYMITY-LEVEL))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-private (is-registered (user principal))
  (ok true)
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-submissions (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-INVALID-MAX-SUBMISSIONS))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-submissions new-max)
    (ok true)
  )
)

(define-public (set-submission-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set submission-fee new-fee)
    (ok true)
  )
)

(define-public (set-rate-limit-per-user (new-limit uint))
  (begin
    (asserts! (> new-limit u0) (err ERR-INVALID-RATE-LIMIT))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set rate-limit-per-user new-limit)
    (ok true)
  )
)

(define-public (set-min-feedback-length (new-min uint))
  (begin
    (asserts! (> new-min u0) (err ERR-INVALID-MIN-FEEDBACK-LENGTH))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set min-feedback-length new-min)
    (ok true)
  )
)

(define-public (set-max-feedback-length (new-max uint))
  (begin
    (asserts! (> new-max (var-get min-feedback-length)) (err ERR-INVALID-MAX-FEEDBACK-LENGTH))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-feedback-length new-max)
    (ok true)
  )
)

(define-public (submit-feedback
  (service-id uint)
  (feedback (string-ascii 1000))
  (category (string-ascii 50))
  (priority uint)
  (location (string-ascii 100))
  (language (string-ascii 20))
  (anonymity-level uint)
)
  (let (
        (next-id (var-get next-submission-id))
        (current-max (var-get max-submissions))
        (authority (var-get authority-contract))
        (user-count (default-to u0 (map-get? submission-count-by-user tx-sender)))
      )
    (try! (is-registered tx-sender))
    (asserts! (< next-id current-max) (err ERR-MAX-SUBMISSIONS-EXCEEDED))
    (asserts! (< user-count (var-get rate-limit-per-user)) (err ERR-INVALID-RATE-LIMIT))
    (try! (validate-service-id service-id))
    (try! (validate-feedback feedback))
    (try! (validate-category category))
    (try! (validate-priority priority))
    (try! (validate-location location))
    (try! (validate-language language))
    (try! (validate-anonymity-level anonymity-level))
    (asserts! (not (is-submission-registered next-id)) (err ERR-SUBMISSION-ALREADY-EXISTS))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get submission-fee) tx-sender authority-recipient))
    )
    (map-set submissions next-id
      {
        service-id: service-id,
        feedback: feedback,
        submitter: tx-sender,
        timestamp: block-height,
        category: category,
        priority: priority,
        location: location,
        language: language,
        anonymity-level: anonymity-level,
        status: true,
        verification-status: false
      }
    )
    (map-set submissions-by-submitter tx-sender
      (cons next-id (default-to (list) (map-get? submissions-by-submitter tx-sender)))
    )
    (map-set submission-count-by-user tx-sender (+ user-count u1))
    (var-set next-submission-id (+ next-id u1))
    (print { event: "feedback-submitted", id: next-id })
    (ok next-id)
  )
)

(define-public (update-submission
  (submission-id uint)
  (update-feedback (string-ascii 1000))
  (update-category (string-ascii 50))
  (update-priority uint)
)
  (let ((submission (map-get? submissions submission-id)))
    (match submission
      s
        (begin
          (asserts! (is-eq (get submitter s) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-feedback update-feedback))
          (try! (validate-category update-category))
          (try! (validate-priority update-priority))
          (map-set submissions submission-id
            {
              service-id: (get service-id s),
              feedback: update-feedback,
              submitter: (get submitter s),
              timestamp: block-height,
              category: update-category,
              priority: update-priority,
              location: (get location s),
              language: (get language s),
              anonymity-level: (get anonymity-level s),
              status: (get status s),
              verification-status: (get verification-status s)
            }
          )
          (map-set submission-updates submission-id
            {
              update-feedback: update-feedback,
              update-timestamp: block-height,
              updater: tx-sender,
              update-category: update-category,
              update-priority: update-priority
            }
          )
          (print { event: "submission-updated", id: submission-id })
          (ok true)
        )
      (err ERR-SUBMISSION-NOT-FOUND)
    )
  )
)

(define-public (verify-submission (submission-id uint))
  (let ((submission (map-get? submissions submission-id)))
    (match submission
      s
        (begin
          (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
          (asserts! (not (get verification-status s)) (err ERR-INVALID-VERIFICATION-STATUS))
          (map-set submissions submission-id
            (merge s { verification-status: true })
          )
          (print { event: "submission-verified", id: submission-id })
          (ok true)
        )
      (err ERR-SUBMISSION-NOT-FOUND)
    )
  )
)

(define-public (deactivate-submission (submission-id uint))
  (let ((submission (map-get? submissions submission-id)))
    (match submission
      s
        (begin
          (asserts! (is-eq (get submitter s) tx-sender) (err ERR-NOT-AUTHORIZED))
          (asserts! (get status s) (err ERR-INVALID-STATUS))
          (map-set submissions submission-id
            (merge s { status: false })
          )
          (print { event: "submission-deactivated", id: submission-id })
          (ok true)
        )
      (err ERR-SUBMISSION-NOT-FOUND)
    )
  )
)

(define-public (get-submission-count)
  (ok (var-get next-submission-id))
)

(define-public (check-submission-existence (id uint))
  (ok (is-submission-registered id))
)