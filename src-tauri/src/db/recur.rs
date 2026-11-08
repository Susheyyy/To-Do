use chrono::{Datelike, Duration, NaiveDate, Weekday};

#[allow(dead_code)]
fn day_abbrev(w: Weekday) -> &'static str {
    match w {
        Weekday::Mon => "every-mon",
        Weekday::Tue => "every-tue",
        Weekday::Wed => "every-wed",
        Weekday::Thu => "every-thu",
        Weekday::Fri => "every-fri",
        Weekday::Sat => "every-sat",
        Weekday::Sun => "every-sun",
    }
}

fn target_weekday(rule: &str) -> Option<Weekday> {
    match rule {
        "every-mon" => Some(Weekday::Mon),
        "every-tue" => Some(Weekday::Tue),
        "every-wed" => Some(Weekday::Wed),
        "every-thu" => Some(Weekday::Thu),
        "every-fri" => Some(Weekday::Fri),
        "every-sat" => Some(Weekday::Sat),
        "every-sun" => Some(Weekday::Sun),
        _ => None,
    }
}

/// Given the last `due_date` and a `recur_rule`, return the next due date.
/// Returns `None` if the rule is unknown or the date cannot be parsed.
pub fn next_due(due_date: &str, recur_rule: &str) -> Option<String> {
    let base = NaiveDate::parse_from_str(due_date, "%Y-%m-%d").ok()?;

    let next = match recur_rule {
        "daily" => base + Duration::days(1),

        "weekdays" => {
            // Skip to next Mon-Fri
            let mut d = base + Duration::days(1);
            while matches!(d.weekday(), Weekday::Sat | Weekday::Sun) {
                d += Duration::days(1);
            }
            d
        }

        "weekends" => {
            // Skip to next Sat-Sun
            let mut d = base + Duration::days(1);
            while !matches!(d.weekday(), Weekday::Sat | Weekday::Sun) {
                d += Duration::days(1);
            }
            d
        }

        "weekly" => base + Duration::weeks(1),

        "monthly" => {
            // Same day next month; clamp to last day if necessary.
            let month = base.month0() + 1;
            let year = base.year() + (month / 12) as i32;
            let month = (month % 12) + 1;
            let day = base.day();
            // Try exact day, then walk back if month is shorter.
            let mut d = day;
            loop {
                if let Some(date) = NaiveDate::from_ymd_opt(year, month, d) {
                    break date;
                }
                d -= 1;
                if d == 0 {
                    return None;
                }
            }
        }

        rule => {
            // "every-mon" … "every-sun"
            let target = target_weekday(rule)?;
            let mut d = base + Duration::days(1);
            while d.weekday() != target {
                d += Duration::days(1);
            }
            d
        }
    };

    Some(next.format("%Y-%m-%d").to_string())
}

#[allow(dead_code)]
pub fn normalise(raw: &str) -> Option<String> {
    let r = raw.trim().to_lowercase();
    match r.as_str() {
        "daily" | "everyday" | "every day" => Some("daily".into()),
        "weekdays" | "every weekday" => Some("weekdays".into()),
        "weekends" | "every weekend" => Some("weekends".into()),
        "weekly" | "everyweek" | "every week" => Some("weekly".into()),
        "monthly" | "every month" => Some("monthly".into()),
        s if s.starts_with("every-") => {
            target_weekday(s).map(|w| day_abbrev(w).to_string())
        }
        _ => None,
    }
}

#[allow(dead_code)]
pub fn label(rule: &str) -> &'static str {
    match rule {
        "daily" => "Daily",
        "weekdays" => "Weekdays",
        "weekends" => "Weekends",
        "weekly" => "Weekly",
        "monthly" => "Monthly",
        "every-mon" => "Every Monday",
        "every-tue" => "Every Tuesday",
        "every-wed" => "Every Wednesday",
        "every-thu" => "Every Thursday",
        "every-fri" => "Every Friday",
        "every-sat" => "Every Saturday",
        "every-sun" => "Every Sunday",
        _ => "Repeats",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_daily_recurrence() {
        let next = next_due("2026-11-01", "daily");
        assert_eq!(next, Some("2026-11-02".to_string()));
    }

    #[test]
    fn test_weekdays_recurrence() {
        // Friday to Monday
        let friday = "2026-11-06";
        let next = next_due(friday, "weekdays");
        assert_eq!(next, Some("2026-11-09".to_string()));
    }

    #[test]
    fn test_monthly_recurrence() {
        let start = "2026-01-15";
        let next = next_due(start, "monthly");
        assert_eq!(next, Some("2026-02-15".to_string()));
    }

    #[test]
    fn test_normalization() {
        assert_eq!(normalise("Every Day"), Some("daily".to_string()));
        assert_eq!(normalise("every weekday"), Some("weekdays".to_string()));
    }
}

