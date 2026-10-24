alter table public.hr_interviews drop constraint hr_interviews_attendance_status_check;
alter table public.hr_interviews add constraint hr_interviews_attendance_status_check
check (attendance_status in ('pending','confirmed','reschedule','absent','no_show'));
