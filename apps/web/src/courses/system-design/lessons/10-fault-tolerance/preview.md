# Preview: Failover

<!-- Subject of the preview image. The shared prompt and the style: docs/plans/lesson-previews.md -->

A mirrored, redundant architecture: two load balancers side by side at the front and, behind them, servers and two database stacks. One load balancer and one database are dark and failed, with small muted red status lights. All accent traffic flows smoothly through the second load balancer and the second database, which has been promoted and now glows as the active one. The system keeps working despite the failures: failover.
