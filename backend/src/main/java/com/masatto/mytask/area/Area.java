package com.masatto.mytask.area;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** エリア（db-design 3.5）。タスクと繰り返しルールを「Project」「Internal」のように分ける単位 */
@Entity
@Table(name = "areas")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Area {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 20)
    private String name;

    @Column(nullable = false, length = 10)
    private String color;

    /** タブの並び順（小さいほど左） */
    @Column(nullable = false)
    private int position;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    public static Area create(String name, AreaColor color, int position, Instant now) {
        Area area = new Area();
        area.name = name;
        area.color = color.value();
        area.position = position;
        area.createdAt = now;
        area.updatedAt = now;
        return area;
    }

    public void update(String name, AreaColor color, Instant now) {
        this.name = name;
        this.color = color.value();
        this.updatedAt = now;
    }

    public void moveTo(int position) {
        this.position = position;
    }
}
