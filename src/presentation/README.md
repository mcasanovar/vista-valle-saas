# Shared presentation

Shared visual components receive data and callbacks through props. They do not import feature logic, routes, persistence, or provider adapters.

Atomic Design imports flow only upward: atoms → molecules → organisms → templates. A higher layer may import a lower layer; the reverse is rejected by ESLint.
