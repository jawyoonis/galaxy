import { Component, OnInit } from '@angular/core';

import { Location } from '@angular/common';

import { ActivatedRoute, Params, Router } from '@angular/router';

import { CardConfig } from 'patternfly-ng/card/basic-card/card-config';

import { NotificationService } from 'patternfly-ng/notification/notification-service/notification.service';
import { NotificationType } from 'patternfly-ng/notification/notification-type';

import { AuthService } from '../auth/auth.service';
import { Email } from '../resources/emails/email';
import { EmailService } from '../resources/emails/email.service';
import { User } from '../resources/users/user';
import { UserService } from '../resources/users/user.service';

@Component({
    selector: 'app-preferences',
    templateUrl: './preferences.component.html',
    styleUrls: ['./preferences.component.less'],
})
export class PreferencesComponent implements OnInit {
    // Used to track which component is being loaded
    componentName = 'PreferencesComponent';

    constructor(
        private notificationService: NotificationService,
        private authService: AuthService,
        private userService: UserService,
        private router: Router,
        private emailService: EmailService,
        private activatedRoute: ActivatedRoute,
        private location: Location,
    ) {}
    emailCard: CardConfig;
    notificationsCard: CardConfig;
    apiKeyCard: CardConfig;
    emails: Email[];
    notificationSettings: any;
    apiKey: string;
    userId: number;
    user: User;

    ngOnInit() {
        this.authService.me().subscribe(me => {
            if (!me.authenticated) {
                this.router.navigate(['/', 'login']);
            } else {
                this.userId = me.id;
                this.getEmails();
                this.getUser();
            }
        });

        this.emailCard = {
            title: 'Email Settings',
        } as CardConfig;

        this.notificationsCard = {
            title: 'Notification Settings',
        } as CardConfig;

        this.apiKeyCard = {
            title: 'API Key',
        } as CardConfig;
    }

    private getUser() {
        this.userService.get(this.userId).subscribe(response => {
            this.user = response;
            this.notificationSettings = [
                {
                    key: 'notify_survey',
                    description: 'someone submits a new survey for one of your roles',
                },
                {
                    key: 'notify_content_release',
                    description: 'there is a new release of a collection you follow',
                },
                {
                    key: 'notify_author_release',
                    description: 'an author you follow releases a new role',
                },
                {
                    key: 'notify_import_fail',
                    description: 'one of your imports fails',
                },
                {
                    key: 'notify_import_success',
                    description: 'one of your imports succeeds',
                },
                {
                    key: 'notify_galaxy_announce',
                    description: 'there is an anouncement from the galaxy team',
                },
            ];
        });
    }

    private getEmails() {
        this.emailService.query({ user_id: this.userId }).subscribe(emails => {
            this.emails = emails;
            this.activatedRoute.queryParams.subscribe((params: Params) => {
                if (params.verify) {
                    this.checkVerification(params);
                }
            });
        });
    }

    private checkVerification(params: Params) {
        this.emailService.verifyEmail(params.verify).subscribe(result => {
            const updateEmail = this.emails.find(obj => obj.id === result.email_address);
            updateEmail.verified = result.verified;

            if (result.verified) {
                this.notificationService.message(
                    NotificationType.SUCCESS,
                    'Verification',
                    `${updateEmail.email} is now verified.`,
                    false,
                    null,
                    null,
                );
            }

            // remove code from URL
            this.location.replaceState(this.location.path().split('?')[0], '');
        });
    }

    private deleteEmail(email: Email) {
        this.emailService.deleteEmail(email).subscribe(response => {
            if (response === null) {
                const index = this.emails.findIndex(i => i.id === email.id);
                this.emails.splice(index, 1);
            }
        });
    }

    setPrimary(email: Email) {
        let currentPrimary = -1;
        let newPrimary = -1;

        currentPrimary = this.emails.findIndex(i => i.primary === true);
        newPrimary = this.emails.findIndex(i => i.id === email.id);

        const newCopy = JSON.parse(JSON.stringify(this.emails[newPrimary]));
        newCopy.primary = true;
        this.emailService.save(newCopy).subscribe(result => {
            if (result) {
                this.emails[newPrimary] = result;
            }
        });

        if (currentPrimary !== -1) {
            const currentCopy = JSON.parse(JSON.stringify(this.emails[currentPrimary]));
            currentCopy.primary = false;
            this.emailService.save(currentCopy).subscribe(result => {
                if (result) {
                    this.emails[currentPrimary] = result;
                }
            });
        }
    }

    verifyEmail(email: Email) {
        this.emailService.sendVerification(email).subscribe(result => {
            if (result) {
                this.notificationService.message(
                    NotificationType.SUCCESS,
                    'Sending Verification',
                    `We've sent your verification code to to ${email.email}`,
                    false,
                    null,
                    null,
                );
            }
        });
    }

    showApiKey() {
        this.userService.getToken(this.userId).subscribe(token => (this.apiKey = token));
    }

    resetApiKey() {
        if (confirm('Resetting your key will remove access to all applications that might rely on it. Do you wish to continue?')) {
            this.userService.resetToken(this.userId).subscribe(token => (this.apiKey = token));
        }
    }

    addNewEmail() {
        const email = {
            email: '',
            verified: false,
            primary: false,
            summary_fields: { new: true },
        } as Email;

        this.emails.push(email);
    }

    saveEmail(email) {
        email.user = this.userId;

        this.emailService.save(email).subscribe(response => {
            if (response) {
                const i = this.emails.findIndex(val => val.email === email.email);
                this.emails[i] = response;
                this.verifyEmail(response);
            }
        });
    }

    handleEmailAction($event) {
        if ($event.id === 'edit') {
            $event.email.summary_fields.new = true;
        } else if ($event.id === 'delete') {
            this.deleteEmail($event.email);
        }
    }

    cancelAddEmail(index: number) {
        this.emails.splice(index, 1);
    }

    updateNotifications() {
        // Slow the update to prevent race condition with ngModel;
        // otherwise, the saved value won't match the UI value.
        setTimeout(() => {
            this.userService.save(this.user).subscribe();
        }, 500);
    }
}
