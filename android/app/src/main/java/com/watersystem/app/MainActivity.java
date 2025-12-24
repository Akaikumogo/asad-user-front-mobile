package com.watersystem.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSION_REQUEST_CODE = 1001;
    private PermissionRequest pendingPermissionRequest;

    @Override
    public void onStart() {
        super.onStart();
        
        // Request microphone permission if not granted
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) 
                    != PackageManager.PERMISSION_GRANTED) {
                // Permission is not granted, but don't request it here
                // Let the web app request it through getUserMedia
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        
        if (requestCode == PERMISSION_REQUEST_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                // Permission granted, handle the pending permission request
                if (pendingPermissionRequest != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    pendingPermissionRequest.grant(pendingPermissionRequest.getResources());
                    pendingPermissionRequest = null;
                }
            } else {
                // Permission denied
                if (pendingPermissionRequest != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    pendingPermissionRequest.deny();
                    pendingPermissionRequest = null;
                }
            }
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        
        // Set up WebChromeClient to handle permission requests
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setWebChromeClient(new WebChromeClient() {
                @Override
                public void onPermissionRequest(PermissionRequest request) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        String[] requestedResources = request.getResources();
                        for (String resource : requestedResources) {
                            if (resource.equals(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
                                // Check if we have permission
                                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO) 
                                        == PackageManager.PERMISSION_GRANTED) {
                                    // Permission already granted
                                    request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                                } else {
                                    // Request permission
                                    pendingPermissionRequest = request;
                                    ActivityCompat.requestPermissions(
                                        MainActivity.this,
                                        new String[]{Manifest.permission.RECORD_AUDIO},
                                        PERMISSION_REQUEST_CODE
                                    );
                                }
                                return;
                            }
                        }
                        // If no audio capture resource, deny the request
                        request.deny();
                    }
                }
            });
        }
    }
}
