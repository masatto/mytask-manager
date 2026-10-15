package com.masatto.mytask;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;

/** テストで現在時刻を自由に動かすための Clock */
public class MutableClock extends Clock {

    private final ZoneId zone;
    private Instant instant;

    public MutableClock(LocalDateTime dateTime, ZoneId zone) {
        this.zone = zone;
        this.instant = dateTime.atZone(zone).toInstant();
    }

    public void set(LocalDateTime dateTime) {
        this.instant = dateTime.atZone(zone).toInstant();
    }

    @Override
    public ZoneId getZone() {
        return zone;
    }

    @Override
    public Clock withZone(ZoneId zone) {
        throw new UnsupportedOperationException();
    }

    @Override
    public Instant instant() {
        return instant;
    }
}
