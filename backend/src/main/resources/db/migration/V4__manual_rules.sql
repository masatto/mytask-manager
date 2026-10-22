-- docs/db-design.md v1.4：手動のルール（自動では作らず、「作成」で必要なときにタスクを作るひな形）

ALTER TABLE recurrence_rules DROP CONSTRAINT ck_rules_pattern;
ALTER TABLE recurrence_rules ADD CONSTRAINT ck_rules_pattern CHECK (
    (pattern_type = 'DAILY'   AND days_of_week IS NULL     AND day_of_month IS NULL) OR
    (pattern_type = 'WEEKLY'  AND days_of_week IS NOT NULL AND day_of_month IS NULL) OR
    (pattern_type = 'MONTHLY' AND days_of_week IS NULL     AND day_of_month IS NOT NULL) OR
    (pattern_type = 'MANUAL'  AND days_of_week IS NULL     AND day_of_month IS NULL)
);
