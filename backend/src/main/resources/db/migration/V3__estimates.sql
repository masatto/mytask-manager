-- docs/db-design.md v1.3：目安時間（分）。親・サブタスク・ルール・ひな形に任意で持つ

ALTER TABLE tasks ADD COLUMN estimate_minutes INTEGER;
ALTER TABLE tasks ADD CONSTRAINT ck_tasks_estimate CHECK (estimate_minutes IS NULL OR estimate_minutes BETWEEN 1 AND 9999);

ALTER TABLE recurrence_rules ADD COLUMN estimate_minutes INTEGER;
ALTER TABLE recurrence_rules ADD CONSTRAINT ck_rules_estimate CHECK (estimate_minutes IS NULL OR estimate_minutes BETWEEN 1 AND 9999);

ALTER TABLE rule_subtask_templates ADD COLUMN estimate_minutes INTEGER;
ALTER TABLE rule_subtask_templates ADD CONSTRAINT ck_templates_estimate CHECK (estimate_minutes IS NULL OR estimate_minutes BETWEEN 1 AND 9999);
