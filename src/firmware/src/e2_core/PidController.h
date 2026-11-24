// =============================================================================
// PidController.h - E2: discrete PID with anti-windup and bumpless reset
// Pure C++, header only, no heap: deterministic and unit-testable on a PC.
// The integral term is kept in output units, so reset(output) starts the
// controller exactly at the current actuator value (no jump when switching mode).
// =============================================================================
#pragma once                                   // include this header only once

class PidController {
 public:
  PidController(float kp, float ki, float kd, float outMin, float outMax)
      : kp_(kp), ki_(ki), kd_(kd), outMin_(outMin), outMax_(outMax) {} // store gains and limits

  void reset(float currentOutput) {            // bumpless (re)start
    integral_ = clamp(currentOutput);          // integral carries the present output
    first_ = true;                             // no derivative on the first update
  }

  float update(float setpoint, float measurement, float dtS) { // one control step
    if (dtS <= 0.0f) {                         // invalid time step
      return clamp(integral_);                 // hold the output
    }
    const float error = setpoint - measurement;// control error
    integral_ = clamp(integral_ + ki_ * error * dtS); // integrate, clamped = anti-windup
    float derivative = 0.0f;                   // derivative term
    if (!first_) {                             // need a previous measurement
      derivative = -kd_ * (measurement - prevMeasurement_) / dtS; // on measurement: no setpoint kick
    }
    first_ = false;                            // next updates have history
    prevMeasurement_ = measurement;            // remember for the next derivative
    return clamp(kp_ * error + integral_ + derivative); // PID sum, limited to the actuator range
  }

 private:
  float clamp(float v) const {                 // limit to [outMin, outMax]
    return v < outMin_ ? outMin_ : (v > outMax_ ? outMax_ : v);
  }

  float kp_, ki_, kd_;                         // gains
  float outMin_, outMax_;                      // output limits
  float integral_ = 0.0f;                      // integral term (output units)
  float prevMeasurement_ = 0.0f;               // last measurement
  bool first_ = true;                          // true until the first update
};
