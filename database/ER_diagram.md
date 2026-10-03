# ER Diagram & Relational Schema

## Entity–Relationship Diagram (Mermaid)

```mermaid
erDiagram
    PATIENT ||--o{ MEDICAL_RECORD     : "has"
    PATIENT ||--o{ BLOOD_SUGAR_RECORD : "records"
    PATIENT ||--o{ LAB_REPORT         : "receives"
    PATIENT ||--o{ MEAL_RECORD        : "logs"
    PATIENT ||--o{ ACTIVITY_RECORD    : "performs"
    PATIENT ||--o{ PREDICTION         : "is assessed by"
    PATIENT ||--o{ RECOMMENDATION     : "receives"
    MEAL    ||--o{ MEAL_RECORD        : "appears in"
    ACTIVITY||--o{ ACTIVITY_RECORD    : "appears in"

    PATIENT {
        int patient_id PK
        varchar name
        int age
        varchar gender
        varchar phone UK
        varchar email UK
        decimal height
        decimal weight
        decimal bmi
    }
    MEDICAL_RECORD {
        int record_id PK
        int patient_id FK
        text medical_history
        varchar existing_conditions
        varchar medications
        date record_date
    }
    BLOOD_SUGAR_RECORD {
        int sugar_record_id PK
        int patient_id FK
        decimal glucose_level
        varchar measurement_type
        datetime record_date
    }
    LAB_REPORT {
        int lab_id PK
        int patient_id FK
        decimal hba1c
        int bp_systolic
        int bp_diastolic
        date report_date
    }
    MEAL {
        int meal_id PK
        varchar meal_name UK
        varchar meal_type
        int calories
        decimal carbohydrates
        text description
    }
    MEAL_RECORD {
        int meal_record_id PK
        int patient_id FK
        int meal_id FK
        date meal_date
        varchar status
    }
    ACTIVITY {
        int activity_id PK
        varchar activity_name UK
        varchar activity_type
        int recommended_duration
        text description
    }
    ACTIVITY_RECORD {
        int activity_record_id PK
        int patient_id FK
        int activity_id FK
        int duration
        int steps
        date activity_date
    }
    PREDICTION {
        int prediction_id PK
        int patient_id FK
        varchar risk_level
        int risk_score
        text remarks
        datetime prediction_date
    }
    RECOMMENDATION {
        int recommendation_id PK
        int patient_id FK
        varchar recommendation_type
        text recommendation_text
        date recommendation_date
    }
```

## Relational Schema (PK underlined → shown in **bold**, FK in *italics*)

| Relation | Attributes |
|---|---|
| patient | **patient_id**, name, age, gender, phone, email, height, weight, bmi, created_at |
| medical_record | **record_id**, *patient_id*, medical_history, existing_conditions, medications, record_date |
| blood_sugar_record | **sugar_record_id**, *patient_id*, glucose_level, measurement_type, record_date |
| lab_report | **lab_id**, *patient_id*, hba1c, bp_systolic, bp_diastolic, report_date |
| meal | **meal_id**, meal_name, meal_type, calories, carbohydrates, description |
| meal_record | **meal_record_id**, *patient_id*, *meal_id*, meal_date, status |
| activity | **activity_id**, activity_name, activity_type, recommended_duration, description |
| activity_record | **activity_record_id**, *patient_id*, *activity_id*, duration, steps, activity_date |
| prediction | **prediction_id**, *patient_id*, risk_level, risk_score, remarks, prediction_date |
| recommendation | **recommendation_id**, *patient_id*, recommendation_type, recommendation_text, recommendation_date |

## Foreign-key relationships

| Child table.column | → Parent table.column | ON DELETE |
|---|---|---|
| medical_record.patient_id | patient.patient_id | CASCADE |
| blood_sugar_record.patient_id | patient.patient_id | CASCADE |
| lab_report.patient_id | patient.patient_id | CASCADE |
| meal_record.patient_id | patient.patient_id | CASCADE |
| meal_record.meal_id | meal.meal_id | RESTRICT |
| activity_record.patient_id | patient.patient_id | CASCADE |
| activity_record.activity_id | activity.activity_id | RESTRICT |
| prediction.patient_id | patient.patient_id | CASCADE |
| recommendation.patient_id | patient.patient_id | CASCADE |

## Normalisation notes

* **1NF** – every attribute is atomic (blood pressure split into `bp_systolic` / `bp_diastolic`; no repeating groups: each reading, meal or activity is its own row).
* **2NF** – all tables use a single-column surrogate primary key, so no partial dependencies exist.
* **3NF** – no transitive dependencies: meal attributes (calories, carbohydrates) live only in `meal`, activity attributes only in `activity`; the association tables store just the FK plus facts about the event (date, status, duration, steps). `bmi` is a derived attribute retained deliberately for reporting and kept consistent by application logic / trigger.
