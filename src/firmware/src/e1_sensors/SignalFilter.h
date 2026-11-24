// =============================================================================
// SignalFilter.h - E1: median-of-5 + exponential moving average (plan E2 "Filtering")
// Pure C++, header only, no heap and no Arduino calls: it runs in a few
// nanoseconds and can be unit tested on a PC (PlatformIO native tests).
// =============================================================================
#pragma once                                   // include this header only once

#include <stdint.h>                            // fixed-width integer types

namespace filt {                               // signal filtering helpers

// Compare-and-swap step of a sorting network: after it, x <= y
inline void compareSwap(float& x, float& y) {  // inlined: no call overhead
  if (y < x) {                                 // values are in the wrong order...
    const float t = x;                         // ...keep x
    x = y;                                     // move the smaller value first
    y = t;                                     // move the larger value second
  }
}

// Median of exactly five values with a fixed 9-step sorting network
// (branch-light, constant time; much faster than a generic sort)
inline float median5(float v0, float v1, float v2, float v3, float v4) {
  compareSwap(v0, v1);                         // network step 1: pair (0,1)
  compareSwap(v3, v4);                         // network step 2: pair (3,4)
  compareSwap(v2, v4);                         // network step 3: pair (2,4)
  compareSwap(v2, v3);                         // network step 4: pair (2,3)
  compareSwap(v0, v3);                         // network step 5: pair (0,3)
  compareSwap(v0, v2);                         // network step 6: pair (0,2)
  compareSwap(v1, v4);                         // network step 7: pair (1,4)
  compareSwap(v1, v3);                         // network step 8: pair (1,3)
  compareSwap(v1, v2);                         // network step 9: pair (1,2)
  return v2;                                   // the middle element is the median
}

// Exponential moving average: y += alpha x (x - y)
class Ema {
 public:
  explicit Ema(float alpha) : alpha_(alpha) {} // alpha in (0,1]: higher = faster response

  float update(float x) {                      // feed one sample, get the smoothed value
    if (!primed_) {                            // first sample ever...
      value_ = x;                              // ...start directly at it (no slow climb from 0)
      primed_ = true;                          // remember that we have a value
    } else {                                   // later samples...
      value_ += alpha_ * (x - value_);         // ...move a fraction of the way toward x
    }
    return value_;                             // return the filtered value
  }

  void reset() { primed_ = false; }            // forget history (after calibration, reconnect)
  float value() const { return value_; }       // last filtered value
  bool primed() const { return primed_; }      // true once at least one sample was seen

 private:
  float alpha_;                                // smoothing factor
  float value_ = 0.0f;                         // current filtered value
  bool primed_ = false;                        // true after the first sample
};

// Sliding median of the last 5 samples followed by an EMA
// (for slow sensors that give one sample per cycle, like the DS18B20)
class MedianEmaFilter {
 public:
  explicit MedianEmaFilter(float alpha) : ema_(alpha) {} // alpha of the EMA stage

  float update(float x) {                      // feed one sample, get the filtered value
    if (!primed_) {                            // first sample...
      for (uint8_t i = 0; i < 5; ++i) {        // ...fill the whole window with it
        window_[i] = x;                        // so the median is meaningful at once
      }
      primed_ = true;                          // window is now full
    } else {                                   // later samples...
      window_[index_] = x;                     // ...overwrite the oldest entry
    }
    index_ = static_cast<uint8_t>((index_ + 1u) % 5u); // advance the ring position
    const float med = median5(window_[0], window_[1], window_[2], window_[3], window_[4]); // reject spikes
    return ema_.update(med);                   // smooth the median
  }

  void reset() {                               // forget all history
    primed_ = false;                           // window will be refilled
    index_ = 0;                                // restart at the first slot
    ema_.reset();                              // restart the average
  }

 private:
  float window_[5] = {0, 0, 0, 0, 0};          // last five samples (ring buffer)
  uint8_t index_ = 0;                          // next slot to overwrite
  bool primed_ = false;                        // true once the window was filled
  Ema ema_;                                    // EMA stage
};

}  // namespace filt
