package com.masatto.mytask;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

/** V1__init.sql の制約が db-design どおりに効いているかを確認する */
@SpringBootTest
class SchemaConstraintTest {

    @Autowired
    JdbcTemplate jdbc;

    @BeforeEach
    void clean() {
        jdbc.update("DELETE FROM tasks");
        jdbc.update("DELETE FROM recurrence_rules");
    }

    private void insertTask(long id, Long parentId, int level, Integer parentLevel) {
        jdbc.update("""
                INSERT INTO tasks (id, title, priority, status, parent_id, level, parent_level, created_at, updated_at)
                VALUES (?, 't', 'MEDIUM', 'TODO', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, id, parentId, level, parentLevel);
    }

    @Test
    void サブタスクの下にサブタスクは作れない() {
        insertTask(1, null, 0, null);
        insertTask(2, 1L, 1, 0);

        // level=1 のサブタスクを参照しようとすると、複合外部キーで拒否される
        assertThatThrownBy(() -> insertTask(3, 2L, 1, 0))
                .isInstanceOf(DataIntegrityViolationException.class);
        // level を偽って参照しても、CHECK 制約で拒否される
        assertThatThrownBy(() -> insertTask(3, 2L, 0, null))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void 親を削除するとサブタスクも削除される() {
        insertTask(1, null, 0, null);
        insertTask(2, 1L, 1, 0);

        jdbc.update("DELETE FROM tasks WHERE id = 1");

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM tasks", Integer.class)).isZero();
    }

    @Test
    void 時刻だけの期限は保存できない() {
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO tasks (title, priority, status, due_time, level, created_at, updated_at)
                VALUES ('t', 'MEDIUM', 'TODO', TIME '10:00:00', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """)).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void 完了ステータスと完了日時は必ずそろう() {
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO tasks (title, priority, status, level, created_at, updated_at)
                VALUES ('t', 'MEDIUM', 'DONE', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """)).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void ルールを削除すると生成済みタスクの参照だけが外れる() {
        jdbc.update("""
                INSERT INTO recurrence_rules (id, title, priority, pattern_type, start_date, active, created_at, updated_at)
                VALUES (10, 'r', 'MEDIUM', 'DAILY', DATE '2026-10-01', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """);
        jdbc.update("""
                INSERT INTO tasks (id, title, priority, status, level, recurrence_rule_id, occurrence_date, created_at, updated_at)
                VALUES (1, 't', 'MEDIUM', 'TODO', 0, 10, DATE '2026-10-14', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """);

        jdbc.update("DELETE FROM recurrence_rules WHERE id = 10");

        assertThat(jdbc.queryForObject("SELECT recurrence_rule_id FROM tasks WHERE id = 1", Long.class)).isNull();
    }

    @Test
    void 同じルールの同じ発生日は二重に生成できない() {
        jdbc.update("""
                INSERT INTO recurrence_rules (id, title, priority, pattern_type, start_date, active, created_at, updated_at)
                VALUES (10, 'r', 'MEDIUM', 'DAILY', DATE '2026-10-01', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """);
        String insert = """
                INSERT INTO tasks (title, priority, status, level, recurrence_rule_id, occurrence_date, created_at, updated_at)
                VALUES ('t', 'MEDIUM', 'TODO', 0, 10, DATE '2026-10-14', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """;
        jdbc.update(insert);

        assertThatThrownBy(() -> jdbc.update(insert)).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void 毎週パターンには曜日が必要() {
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO recurrence_rules (title, priority, pattern_type, start_date, active, created_at, updated_at)
                VALUES ('r', 'MEDIUM', 'WEEKLY', DATE '2026-10-01', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """)).isInstanceOf(DataIntegrityViolationException.class);
    }
}
